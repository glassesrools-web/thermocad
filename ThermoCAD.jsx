import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  PRESETS_MURS,
  PRESETS_TOITURES,
  PRESETS_PLANCHERS,
  VITRAGE_OPTS,
  LAME_OPTS,
  CADRE_OPTS,
  MATERIAU_OPTS,
  ISOLANT_OPTS,
  gKV,
  gKP,
} from "../data/dtrMaterials.js";

// Local DTR-C3.2 default values (match dtrMaterials.js keys)
const DTR_DEFAULT_WALL_PRESET = "db_brique_10_air_10";
const DTR_DEFAULT_WALL_U      = 1.28;
const DTR_DEFAULT_ROOF_PRESET = "terrasse_isol_8cm";
const DTR_DEFAULT_ROOF_U      = 0.48;
const DTR_DEFAULT_FLOOR_PRESET = "dalle_pleine_15cm";
const DTR_DEFAULT_FLOOR_U     = 2.70;
const DTR_DEFAULT_WIN_TYPE    = "double";
const DTR_DEFAULT_WIN_LAME    = "10_11";
const DTR_DEFAULT_WIN_CADRE   = "bois_pvc";
const DTR_DEFAULT_DOOR_MAT    = "bois_3_2cm";

const safeNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const SC = 50;
const SR = 18;
const WW = 5;
const MAX_HISTORY = 50;
const DEFAULT_H = 2.8;
const DEFAULT_DOOR_W = 0.9;
const DEFAULT_DOOR_H = 2.1;
const DEFAULT_WIN_W = 1.2;
const DEFAULT_WIN_H = 1.2;

// Small square button used by the blueprint offset nudgers.
const nudgeBtnStyle = {
  width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "#122032", border: "1px solid #1f3248", borderRadius: 4, color: "#cbd5e1",
  fontSize: 10, fontWeight: "700", cursor: "pointer", padding: 0, lineHeight: 1,
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const projSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (!l2) return { pt: { ...a }, t: 0 };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return { pt: { x: a.x + t * dx, y: a.y + t * dy }, t };
};

// ── NEW: Auto-Orientation Math ──────────────────────────────────────
const getOrientation = (x1, y1, x2, y2) => {
  let normAng = Math.atan2(-(y2 - y1), x2 - x1) * (180 / Math.PI) + 90;
  if (normAng < 0) normAng += 360;
  const dirs = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
  return dirs[Math.round(normAng / 45) % 8];
};

const shoelace = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const n = pts[(i + 1) % pts.length];
    s += pts[i].x * n.y - n.x * pts[i].y;
  }
  return Math.abs(s) / 2;
};

const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

const wallLengthM = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / SC;

const makeWall = (id, x1, y1, x2, y2, height = DEFAULT_H) => {
  const length = parseFloat(wallLengthM({ x1, y1, x2, y2 }).toFixed(3));
  const grossArea = parseFloat((length * height).toFixed(3));
  return { id, x1, y1, x2, y2, height, length, grossArea };
};

const roomHsl = (i) => `hsl(${(i * 67 + 30) % 360},58%,55%)`;
const roomHsla = (i, a) => `hsla(${(i * 67 + 30) % 360},58%,55%,${a})`;

// ── Point-in-polygon (ray casting) ──────────────────────────────────
const pointInPolygon = (pt, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
};

// ── Planar graph face detection ──────────────────────────────────────
const detectRoomsFromGraph = (currentWalls, existingRooms, defaultH, rRefObj) => {
  if (currentWalls.length < 3) return existingRooms;

  const EPS = 3;
  const verts = [];
  const getVIdx = (x, y) => {
    for (let i = 0; i < verts.length; i++)
      if (Math.abs(verts[i].x - x) < EPS && Math.abs(verts[i].y - y) < EPS) return i;
    verts.push({ x, y });
    return verts.length - 1;
  };

  // T-Junction splitting: register every endpoint first so intermediate
  // vertices are known, then subdivide walls that pass through them.
  currentWalls.forEach(w => { getVIdx(w.x1, w.y1); getVIdx(w.x2, w.y2); });

  const splitWalls = [];
  currentWalls.forEach(w => {
    const ax = w.x1, ay = w.y1, bx = w.x2, by = w.y2;
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    if (len2 < 1) return;
    const splits = [];
    verts.forEach((v, vi) => {
      if ((Math.abs(v.x - ax) < EPS && Math.abs(v.y - ay) < EPS) ||
          (Math.abs(v.x - bx) < EPS && Math.abs(v.y - by) < EPS)) return;
      const t = ((v.x - ax) * (bx - ax) + (v.y - ay) * (by - ay)) / len2;
      if (t <= 0 || t >= 1) return;
      const px = ax + t * (bx - ax), py = ay + t * (by - ay);
      if (Math.abs(px - v.x) < EPS && Math.abs(py - v.y) < EPS) splits.push({ t, vi });
    });
    if (!splits.length) { splitWalls.push(w); return; }
    splits.sort((a, b) => a.t - b.t);
    let prevX = ax, prevY = ay;
    splits.forEach(({ vi }) => {
      const { x: nx, y: ny } = verts[vi];
      splitWalls.push({ ...w, x1: prevX, y1: prevY, x2: nx, y2: ny });
      prevX = nx; prevY = ny;
    });
    splitWalls.push({ ...w, x1: prevX, y1: prevY, x2: bx, y2: by });
  });

  const halfEdges = [];
  splitWalls.forEach(w => {
    const a = getVIdx(w.x1, w.y1);
    const b = getVIdx(w.x2, w.y2);
    if (a !== b) {
      halfEdges.push({ from: a, to: b, wallId: w.id });
      halfEdges.push({ from: b, to: a, wallId: w.id });
    }
  });
  if (!halfEdges.length) return existingRooms;

  const outEdges = verts.map(() => []);
  halfEdges.forEach((he, i) => {
    const fv = verts[he.from], tv = verts[he.to];
    outEdges[he.from].push({ heIdx: i, angle: Math.atan2(tv.y - fv.y, tv.x - fv.x), to: he.to });
  });
  outEdges.forEach(arr => arr.sort((a, b) => a.angle - b.angle));

  const nextHE = new Array(halfEdges.length).fill(-1);
  halfEdges.forEach((he, i) => {
    const arr = outEdges[he.to];
    const revPos = arr.findIndex(e => e.to === he.from);
    if (revPos === -1) return;
    const prevPos = (revPos - 1 + arr.length) % arr.length;
    nextHE[i] = arr[prevPos].heIdx;
  });

  const used = new Set();
  const faces = [];
  for (let start = 0; start < halfEdges.length; start++) {
    if (used.has(start) || nextHE[start] === -1) continue;
    const faceVerts = [], faceWallIds = new Set();
    let curr = start, iter = 0;
    while (!used.has(curr) && iter++ < halfEdges.length) {
      used.add(curr);
      faceVerts.push(halfEdges[curr].from);
      faceWallIds.add(halfEdges[curr].wallId);
      const nxt = nextHE[curr];
      if (nxt === -1 || nxt === start) break;
      curr = nxt;
    }
    if (faceVerts.length < 3) continue;
    const pts = faceVerts.map(vi => ({ ...verts[vi] }));
    let area2 = 0;
    for (let j = 0; j < pts.length; j++) {
      const n = pts[(j + 1) % pts.length];
      area2 += pts[j].x * n.y - n.x * pts[j].y;
    }
    // Filter micro-rooms smaller than 0.1 m²
    const areaM2 = area2 / 2 / (SC * SC);
    if (area2 > 0 && areaM2 >= 0.1)
      faces.push({ pts, areaM2: parseFloat(areaM2.toFixed(3)), wallIds: [...faceWallIds] });
  }

  const usedExisting = new Set();
  return faces.map(face => {
    let matched = null;
    for (const rm of existingRooms) {
      if (usedExisting.has(rm.id)) continue;
      const rmC = centroid(rm.points || []);
      if (pointInPolygon(rmC, face.pts)) { matched = rm; break; }
    }
    if (!matched) {
      let bestScore = 0;
      for (const rm of existingRooms) {
        if (usedExisting.has(rm.id)) continue;
        const rmSet = new Set(rm.wallIds || []);
        const fSet = new Set(face.wallIds);
        let ov = 0;
        for (const id of fSet) if (rmSet.has(id)) ov++;
        const score = ov / Math.max(fSet.size, rmSet.size, 1);
        if (score > bestScore && score >= 0.6) { bestScore = score; matched = rm; }
      }
    }
    if (matched) {
      usedExisting.add(matched.id);
      // Strip virtual T-junction split IDs; keep only real wall IDs
      const realIds = face.wallIds.filter(id => currentWalls.some(w => w.id === id));
      return { ...matched, points: face.pts, area: face.areaM2, wallIds: realIds };
    }
    const ci = ++rRefObj.current;
    return {
      id: `r${ci}`, name: `Pièce ${ci}`,
      points: face.pts, area: face.areaM2,
      colorIdx: ci, color: roomHsl(ci),
      roomHeight: defaultH,
      wallIds: face.wallIds.filter(id => currentWalls.some(w => w.id === id)),
    };
  });
};

function MiniInput({ value, onChange, style, min = 0.1, max = 100, step = 0.1 }) {
  return (
    <input
      type="number" min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={style}
      onClick={e => e.stopPropagation()}
    />
  );
}

function StatRow({ label, val, col, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ color: "#4a6a8a", fontSize: 11 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ color: col || "#c8d8f0", fontSize: 12, fontFamily: "monospace", fontWeight: "700" }}>{val}</span>
        {sub && <div style={{ color: "#3a5568", fontSize: 10, fontFamily: "monospace" }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function ThermoCAD({ onExportSurfaces } = {}) {
  const cvs = useRef(null);
  const cvsWrapRef = useRef(null); // canvas container — watched by ResizeObserver
  const wRef = useRef(0);
  const rRef = useRef(0);
  const polyWallIds = useRef([]);
  const skipRoomDetect = useRef(false);
  const fileInputRef = useRef(null);

  const nwid = () => `w${++wRef.current}`;
  const nrid = () => `r${++rRef.current}`;

  const [walls, setWalls] = useState([]);
  const [doors, setDoors] = useState([]);
  const [wins, setWins] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [mode, setMode] = useState("wall");
  const [poly, setPoly] = useState([]);
  const [sp, setSp] = useState(null);
  const [info, setInfo] = useState("");
  const [keyInput, setKeyInput] = useState("");

  const [selected, setSelected] = useState(null);
  const [globalHeight, setGlobalHeight] = useState(DEFAULT_H);
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [activeReport, setActiveReport] = useState(null);
  const [activeTab, setActiveTab] = useState("rooms");

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const keyInputRef = useRef(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const isSpacePanRef = useRef(false);

  const [multiSelected, setMultiSelected] = useState(new Set());

  const [bgImage, setBgImage] = useState(null);
  const [bgScale, setBgScale] = useState(1);
  const [bgOpacity, setBgOpacity] = useState(0.3);
  const [bgOffsetX, setBgOffsetX] = useState(0);
  const [bgOffsetY, setBgOffsetY] = useState(0);

  // Responsive canvas: buffer dimensions tracked separately so the draw effect
  // re-runs automatically after a resize without touching any thermal logic.
  const [canvasSize, setCanvasSize] = useState({ w: 820, h: 640 });

  const NUDGE_STEP = 10;

  // Keep canvas buffer dimensions in sync with the available layout space.
  // This runs once on mount; `canvasSize` state change triggers the draw effect.
  useEffect(() => {
    const el = cvsWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => setBgImage(img);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const wallsEnriched = useMemo(() =>
    walls.map(w => {
      const wallDoors = doors.filter(d => d.wid === w.id);
      const wallWins = wins.filter(wv => wv.wid === w.id);
      const openingArea = parseFloat(
        [...wallDoors, ...wallWins].reduce((s, o) => s + (o.area || 0), 0).toFixed(3)
      );
      const netArea = Math.max(0, parseFloat((w.grossArea - openingArea).toFixed(3)));
      return { ...w, netArea, openingArea };
    }), [walls, doors, wins]);

  const roomsEnriched = useMemo(() =>
    rooms.map(rm => {
      const roomH = rm.roomHeight || globalHeight;
      const floor = rm.area || 0;
      const roomWalls = wallsEnriched.filter(w => (rm.wallIds || []).includes(w.id));
      const roomDoors = doors.filter(d => (rm.wallIds || []).includes(d.wid));
      const roomWindows = wins.filter(wv => (rm.wallIds || []).includes(wv.wid));
      const grossWall = roomWalls.reduce((s, w) => s + w.grossArea, 0);
      const netWall = roomWalls.reduce((s, w) => s + w.netArea, 0);
      const winArea = roomWindows.reduce((s, wv) => s + (wv.area || 0), 0);
      const doorArea = roomDoors.reduce((s, d) => s + (d.area || 0), 0);
      const volume = parseFloat((floor * roomH).toFixed(3));
      return {
        ...rm, roomHeight: roomH,
        floorArea: floor, ceilingArea: floor, volume,
        grossWallArea: parseFloat(grossWall.toFixed(3)),
        netWallArea: parseFloat(netWall.toFixed(3)),
        windowArea: parseFloat(winArea.toFixed(3)),
        doorArea: parseFloat(doorArea.toFixed(3)),
        wallCount: roomWalls.length,
        windowCount: roomWindows.length,
        doorCount: roomDoors.length,
        totalGrossSurface: parseFloat((floor * 2 + grossWall).toFixed(3)),
        totalNetSurface: parseFloat((floor * 2 + netWall).toFixed(3)),
      };
    }), [rooms, wallsEnriched, doors, wins, globalHeight]);

  const totals = useMemo(() => ({
    grossWall: wallsEnriched.reduce((s, w) => s + w.grossArea, 0),
    netWall: wallsEnriched.reduce((s, w) => s + w.netArea, 0),
    floor: rooms.reduce((s, r) => s + (r.area || 0), 0),
    volume: roomsEnriched.reduce((s, r) => s + r.volume, 0),
    windows: wins.reduce((s, w) => s + (w.area || 0), 0),
    doors: doors.reduce((s, d) => s + (d.area || 0), 0),
  }), [wallsEnriched, rooms, roomsEnriched, wins, doors]);

  const selectedEl = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "wall") return wallsEnriched.find(w => w.id === selected.id) || null;
    if (selected.type === "door") return doors.find(d => d.id === selected.id) || null;
    if (selected.type === "window") return wins.find(w => w.id === selected.id) || null;
    return null;
  }, [selected, wallsEnriched, doors, wins]);

  const getSnapshot = useCallback(() =>
    structuredClone({ walls, doors, wins, rooms, poly }),
    [walls, doors, wins, rooms, poly]);

  const pushUndo = useCallback((snap) => {
    setUndoStack(prev => [...prev.slice(-(MAX_HISTORY - 1)), snap]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (!prev.length) return prev;
      const snap = prev[prev.length - 1];
      setRedoStack(r => [...r.slice(-(MAX_HISTORY - 1)), getSnapshot()]);
      skipRoomDetect.current = true;
      setWalls(snap.walls); setDoors(snap.doors);
      setWins(snap.wins); setRooms(snap.rooms);
      setPoly(snap.poly || []);
      return prev.slice(0, -1);
    });
  }, [getSnapshot]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (!prev.length) return prev;
      const snap = prev[prev.length - 1];
      setUndoStack(u => [...u.slice(-(MAX_HISTORY - 1)), getSnapshot()]);
      skipRoomDetect.current = true;
      setWalls(snap.walls); setDoors(snap.doors);
      setWins(snap.wins); setRooms(snap.rooms);
      setPoly(snap.poly || []);
      return prev.slice(0, -1);
    });
  }, [getSnapshot]);

  const getSnap = useCallback((x, y) => {
    const p = { x, y };
    const epMap = new Map();
    walls.forEach(w => {
      epMap.set(`${w.x1},${w.y1}`, { x: w.x1, y: w.y1 });
      epMap.set(`${w.x2},${w.y2}`, { x: w.x2, y: w.y2 });
    });
    poly.forEach(pt => epMap.set(`${pt.x},${pt.y}`, pt));
    let best = null, bestD = SR;
    for (const e of epMap.values()) {
      const d = dist(p, e);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) return { x: best.x, y: best.y, type: "ep" };

    for (const w of walls) {
      const m = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
      if (dist(p, m) < SR) return { ...m, type: "mid" };
    }
    for (const w of walls) {
      const { pt, t } = projSeg(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (t > 0.05 && t < 0.95 && dist(p, pt) < SR)
        return { ...pt, type: "onwall", wid: w.id };
    }
    if (poly.length > 0) {
      const L = poly[poly.length - 1];
      const adx = Math.abs(x - L.x), ady = Math.abs(y - L.y);
      if (Math.hypot(adx, ady) > 10) {
        if (adx < SR * 1.2 && ady > adx * 1.5) return { x: L.x, y, type: "ortho" };
        if (ady < SR * 1.2 && adx > ady * 1.5) return { x, y: L.y, type: "ortho" };
      }
    }
    const gx = Math.round(x / SC) * SC, gy = Math.round(y / SC) * SC;
    if (Math.abs(x - gx) < SR * 0.6 && Math.abs(y - gy) < SR * 0.6)
      return { x: gx, y: gy, type: "grid" };
    return { x, y, type: "free" };
  }, [walls, poly]);

  const applyKeyLength = useCallback((metres) => {
    if (!poly.length || !sp) return null;
    const last = poly[poly.length - 1];
    const dx = sp.x - last.x, dy = sp.y - last.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.001) return null;
    const px = metres * SC;
    return { x: last.x + (dx / mag) * px, y: last.y + (dy / mag) * px };
  }, [poly, sp]);

  const onMove = useCallback((e) => {
    if (isPanningRef.current) {
      setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }
    const r = cvs.current.getBoundingClientRect();
    const scaleX = cvs.current.width / r.width;
    const scaleY = cvs.current.height / r.height;
    const s = getSnap(
      (e.clientX - r.left) * scaleX - pan.x,
      (e.clientY - r.top)  * scaleY - pan.y
    );
    setSp(s);
    if (poly.length > 0 && s) {
      const last = poly[poly.length - 1];
      if (keyInput) {
        const m = parseFloat(keyInput);
        setInfo(isNaN(m) ? `⌨ ${keyInput}` : `⌨ ${m.toFixed(2)} m → Entrée`);
      } else {
        const len = dist(last, s) / SC;
        const ang = (Math.atan2(s.y - last.y, s.x - last.x) * 180 / Math.PI).toFixed(1);
        const closing = poly.length >= 3 && dist(s, poly[0]) < SR;
        setInfo(closing ? "🟢 Cliquer pour fermer la pièce" : `📏 ${len.toFixed(2)} m   ${ang}°`);
      }
    } else { setInfo(""); }
  }, [getSnap, poly, keyInput, pan]);

  const onClick = useCallback((e) => {
    if (e.detail > 1) return;
    const rect = cvs.current.getBoundingClientRect();
    const scaleX = cvs.current.width / rect.width;
    const scaleY = cvs.current.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX - pan.x;
    const py = (e.clientY - rect.top)  * scaleY - pan.y;
    let s = getSnap(px, py);

    if (mode === "select") {
      let hit = null;
      for (const d of doors) {
        if (dist({ x: px, y: py }, { x: d.x, y: d.y }) < (d.width || DEFAULT_DOOR_W) * SC / 2 + 14) {
          hit = { type: "door", id: d.id }; break;
        }
      }
      if (!hit) {
        for (const wv of wins) {
          if (dist({ x: px, y: py }, { x: wv.x, y: wv.y }) < (wv.width || DEFAULT_WIN_W) * SC / 2 + 14) {
            hit = { type: "window", id: wv.id }; break;
          }
        }
      }
      if (!hit) {
        for (const w of walls) {
          const { pt } = projSeg({ x: px, y: py }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
          if (dist({ x: px, y: py }, pt) < WW + 8) { hit = { type: "wall", id: w.id }; break; }
        }
      }
      if (e.ctrlKey && hit && hit.type === "wall") {
        setMultiSelected(prev => {
          const next = new Set(prev);
          if (next.has(hit.id)) { next.delete(hit.id); } else { next.add(hit.id); }
          // If only one remains after toggle, keep it as the active single selection
          if (next.size === 1) setSelected({ type: "wall", id: [...next][0] });
          else setSelected(null);
          return next;
        });
        setActiveTab("props");
        return;
      }
      setMultiSelected(new Set());
      setSelected(hit);
      setActiveTab("props");
      return;
    }

    if (mode === "wall") {
      if (keyInput && poly.length > 0) {
        const m = parseFloat(keyInput.replace(/[mM]/g, ""));
        if (!isNaN(m) && m > 0) { const exact = applyKeyLength(m); if (exact) s = { ...exact, type: "key" }; }
        setKeyInput("");
      }
      if (poly.length === 0) {
        polyWallIds.current = [];
        if (s.type === "onwall") {
          const snap = getSnapshot(); pushUndo(snap);
          const orig = walls.find(w => w.id === s.wid);
          if (orig) {
            const w1 = makeWall(nwid(), orig.x1, orig.y1, s.x, s.y, orig.height);
            const w2 = makeWall(nwid(), s.x, s.y, orig.x2, orig.y2, orig.height);
            setWalls(prev => [...prev.filter(w => w.id !== orig.id), w1, w2]);
            setRooms(prev => prev.map(rm => ({
              ...rm,
              wallIds: (rm.wallIds || []).flatMap(id => id === orig.id ? [w1.id, w2.id] : [id]),
            })));
          }
        }
        setPoly([{ x: s.x, y: s.y }]);
      } else {
        const first = poly[0], last = poly[poly.length - 1];
        if (dist(last, s) < 2) return;
        if (poly.length >= 3 && dist(s, first) < SR) {
          const snap = getSnapshot(); pushUndo(snap);
          const closingWall = makeWall(nwid(), last.x, last.y, first.x, first.y, globalHeight);
          setWalls(prev => [...prev, closingWall]);
          polyWallIds.current = [];
          setPoly([]); setInfo("");
        } else {
          const snap = getSnapshot(); pushUndo(snap);
          const newWall = makeWall(nwid(), last.x, last.y, s.x, s.y, globalHeight);
          setWalls(prev => [...prev, newWall]);
          polyWallIds.current.push(newWall.id);
          setPoly(prev => [...prev, { x: s.x, y: s.y }]);
        }
      }
    } else if (mode === "door" || mode === "window") {
      let nearWall = null, nearDist = Infinity, nearPt = null, nearT = 0.5;
      for (const w of walls) {
        const { pt, t } = projSeg({ x: px, y: py }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const d = dist({ x: px, y: py }, pt);
        if (d < nearDist && t > 0.05 && t < 0.95) { nearDist = d; nearWall = w; nearPt = pt; nearT = t; }
      }
      if (nearWall && nearDist < 32) {
        const snap = getSnapshot(); pushUndo(snap);
        const angle = Math.atan2(nearWall.y2 - nearWall.y1, nearWall.x2 - nearWall.x1);
        const wallLenPx = dist({ x: nearWall.x1, y: nearWall.y1 }, { x: nearWall.x2, y: nearWall.y2 });

        const openingW = mode === "door" ? DEFAULT_DOOR_W : DEFAULT_WIN_W;
        const halfPx = (openingW * SC) / 2;
        const minT = wallLenPx > 0 ? halfPx / wallLenPx : 0.5;
        const maxT = wallLenPx > 0 ? 1 - halfPx / wallLenPx : 0.5;
        const clampedT = Math.max(minT, Math.min(maxT, nearT));
        const clampedPt = {
          x: nearWall.x1 + clampedT * (nearWall.x2 - nearWall.x1),
          y: nearWall.y1 + clampedT * (nearWall.y2 - nearWall.y1),
        };

        if (mode === "door") {
          setDoors(prev => [...prev, {
            id: `door${Date.now()}`, x: clampedPt.x, y: clampedPt.y, angle, wid: nearWall.id,
            width: DEFAULT_DOOR_W, height: DEFAULT_DOOR_H,
            area: parseFloat((DEFAULT_DOOR_W * DEFAULT_DOOR_H).toFixed(3)),
          }]);
        } else {
          setWins(prev => [...prev, {
            id: `win${Date.now()}`, x: clampedPt.x, y: clampedPt.y, angle, wid: nearWall.id,
            width: DEFAULT_WIN_W, height: DEFAULT_WIN_H,
            area: parseFloat((DEFAULT_WIN_W * DEFAULT_WIN_H).toFixed(3)),
          }]);
        }
      }
    }
  }, [mode, poly, walls, doors, wins, getSnap, getSnapshot, pushUndo, keyInput, applyKeyLength, globalHeight, pan]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    const snap = getSnapshot(); pushUndo(snap);
    if (selected.type === "wall") {
      setWalls(prev => prev.filter(w => w.id !== selected.id));
      setDoors(prev => prev.filter(d => d.wid !== selected.id));
      setWins(prev => prev.filter(w => w.wid !== selected.id));
      setRooms(prev => prev.map(r => ({
        ...r, wallIds: (r.wallIds || []).filter(id => id !== selected.id)
      })));
    } else if (selected.type === "door") {
      setDoors(prev => prev.filter(d => d.id !== selected.id));
    } else if (selected.type === "window") {
      setWins(prev => prev.filter(w => w.id !== selected.id));
    }
    setSelected(null);
  }, [selected, getSnapshot, pushUndo]);

  const updateWallHeight = useCallback((id, val) => {
    const h = parseFloat(val);
    if (!isNaN(h) && h > 0)
      setWalls(prev => prev.map(w => w.id !== id ? w : {
        ...w, height: h, grossArea: parseFloat((w.length * h).toFixed(3))
      }));
  }, []);

  const updateDoor = useCallback((id, field, val) => {
    const v = parseFloat(val);
    if (!isNaN(v) && v > 0)
      setDoors(prev => prev.map(d => {
        if (d.id !== id) return d;
        const next = { ...d, [field]: v };
        if (field === "width") {
          const wall = walls.find(w => w.id === d.wid);
          if (wall) next.width = Math.min(next.width, Math.max(0.1, wall.length - 0.05));
        }
        next.area = parseFloat((next.width * next.height).toFixed(3));
        return next;
      }));
  }, [walls]);

  const updateWindow = useCallback((id, field, val) => {
    const v = parseFloat(val);
    if (!isNaN(v) && v > 0)
      setWins(prev => prev.map(w => {
        if (w.id !== id) return w;
        const next = { ...w, [field]: v };
        if (field === "width") {
          const wall = walls.find(wl => wl.id === w.wid);
          if (wall) next.width = Math.min(next.width, Math.max(0.1, wall.length - 0.05));
        }
        next.area = parseFloat((next.width * next.height).toFixed(3));
        return next;
      }));
  }, [walls]);

  const updateRoomHeight = useCallback((id, val) => {
    const h = parseFloat(val);
    if (!isNaN(h) && h > 0)
      setRooms(prev => prev.map(r => r.id !== id ? r : { ...r, roomHeight: h }));
  }, []);

  const applyHeightToAll = useCallback(() => {
    const snap = getSnapshot(); pushUndo(snap);
    setWalls(prev => prev.map(w => ({
      ...w, height: globalHeight, grossArea: parseFloat((w.length * globalHeight).toFixed(3)),
    })));
    setRooms(prev => prev.map(r => ({ ...r, roomHeight: globalHeight })));
  }, [globalHeight, getSnapshot, pushUndo]);

  const commitTypedLength = useCallback(() => {
    const m = parseFloat(keyInput.replace(/[mM]/g, ""));
    if (!isNaN(m) && m > 0 && sp && poly.length > 0) {
      const exact = applyKeyLength(m);
      if (exact && dist(poly[poly.length - 1], exact) >= 2) {
        const snap = getSnapshot(); pushUndo(snap);
        const newWall = makeWall(nwid(), poly[poly.length - 1].x, poly[poly.length - 1].y, exact.x, exact.y, globalHeight);
        setWalls(prev => [...prev, newWall]);
        polyWallIds.current.push(newWall.id);
        setPoly(prev => [...prev, exact]);
      }
    }
    setKeyInput("");
  }, [keyInput, sp, poly, applyKeyLength, getSnapshot, pushUndo, globalHeight]);

  const onMouseDown = useCallback((e) => {
    if (e.button === 1) { e.preventDefault(); isPanningRef.current = true; }
  }, []);

  useEffect(() => {
    const up = (e) => { if (e.button === 1) isPanningRef.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Escape") {
        setPoly([]); setInfo(""); setKeyInput(""); setSelected(null); polyWallIds.current = []; return;
      }
      if (e.key === "Delete" || (e.key === "Backspace" && !keyInput)) { deleteSelected(); return; }
      if (mode !== "wall" || poly.length === 0) return;
      if (/^[0-9]$/.test(e.key) || (e.key === "." && !keyInput.includes("."))) {
        setKeyInput(prev => prev + e.key); e.preventDefault(); return;
      }
      if (e.key === "Backspace" && keyInput) { setKeyInput(prev => prev.slice(0, -1)); e.preventDefault(); return; }
      if (e.key === "Enter" && keyInput) { commitTypedLength(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, poly, keyInput, undo, redo, deleteSelected, commitTypedLength]);

  useEffect(() => {
    if (skipRoomDetect.current) { skipRoomDetect.current = false; return; }
    setRooms(prev => detectRoomsFromGraph(walls, prev, globalHeight, rRef));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls]);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = "#0d1520";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(pan.x, pan.y);

    if (bgImage) {
      ctx.save();
      ctx.globalAlpha = bgOpacity;
      const imgW = bgImage.width * bgScale;
      const imgH = bgImage.height * bgScale;
      const drawX = (W - imgW) / 2 + bgOffsetX;
      const drawY = (H - imgH) / 2 + bgOffsetY;
      ctx.drawImage(bgImage, drawX, drawY, imgW, imgH);
      ctx.restore();
    }

    if (showGrid) {
      const gxStart = Math.floor(-pan.x / SC) * SC;
      const gxEnd   = W - pan.x + SC;
      const gyStart = Math.floor(-pan.y / SC) * SC;
      const gyEnd   = H - pan.y + SC;
      for (let x = gxStart; x <= gxEnd; x += SC) {
        const major = ((x % (SC * 5)) + SC * 5) % (SC * 5) === 0;
        ctx.strokeStyle = major ? "#192840" : "#101c2a";
        ctx.lineWidth = major ? 0.9 : 0.4;
        ctx.beginPath(); ctx.moveTo(x, gyStart); ctx.lineTo(x, gyEnd); ctx.stroke();
      }
      for (let y = gyStart; y <= gyEnd; y += SC) {
        const major = ((y % (SC * 5)) + SC * 5) % (SC * 5) === 0;
        ctx.strokeStyle = major ? "#192840" : "#101c2a";
        ctx.lineWidth = major ? 0.9 : 0.4;
        ctx.beginPath(); ctx.moveTo(gxStart, y); ctx.lineTo(gxEnd, y); ctx.stroke();
      }
      if (showDimensions) {
        ctx.fillStyle = "#1e3050"; ctx.font = "9px monospace"; ctx.textAlign = "center";
        for (let x = gxStart; x <= gxEnd; x += SC * 5)
          ctx.fillText(`${Math.round(x / SC)}m`, x, -pan.y + 10);
        ctx.textAlign = "right";
        for (let y = gyStart; y <= gyEnd; y += SC * 5)
          ctx.fillText(`${Math.round(y / SC)}m`, -pan.x + 20, y + 3);
      }
    }

    rooms.forEach((rm, idx) => {
      if (rm.points.length < 3) return;
      const ci = rm.colorIdx ?? idx;
      ctx.beginPath();
      ctx.moveTo(rm.points[0].x, rm.points[0].y);
      rm.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = roomHsla(ci, 0.09);
      ctx.fill();
      ctx.strokeStyle = roomHsla(ci, 0.22);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    wallsEnriched.forEach(w => {
      const isSel = selected?.id === w.id && selected?.type === "wall";
      if (isSel) {
        ctx.save();
        ctx.strokeStyle = "rgba(251,191,36,0.14)"; ctx.lineWidth = WW + 18; ctx.lineCap = "round";
        ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = isSel ? "#fbbf24" : "#a8c0d8";
      ctx.lineWidth = isSel ? WW + 2 : WW;
      ctx.lineCap = "square"; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();

      if (w.length > 0.15 && showDimensions) {
        const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
        const ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.textAlign = "center";
        ctx.fillStyle = isSel ? "#fbbf24" : "#3d5a78";
        ctx.font = isSel ? "bold 10px monospace" : "10px monospace";
        ctx.fillText(`${w.length.toFixed(2)} m`, 0, -8);
        if (w.openingArea > 0) {
          ctx.fillStyle = "#22c55e"; ctx.font = "9px monospace";
          ctx.fillText(`Net: ${w.netArea.toFixed(2)} m²`, 0, 13);
        } else {
          ctx.fillStyle = isSel ? "rgba(251,191,36,0.65)" : "#253545";
          ctx.font = "9px monospace";
          ctx.fillText(`${w.grossArea.toFixed(2)} m²`, 0, 13);
        }
        ctx.restore();
      }
    });

    doors.forEach(dv => {
      const isSel = selected?.id === dv.id && selected?.type === "door";
      const cos = Math.cos(dv.angle), sin = Math.sin(dv.angle);
      const doorPx = (dv.width || DEFAULT_DOOR_W) * SC;
      const hx = dv.x - cos * doorPx / 2, hy = dv.y - sin * doorPx / 2;
      const tx = dv.x + cos * doorPx / 2, ty = dv.y + sin * doorPx / 2;
      ctx.strokeStyle = "#0d1520"; ctx.lineWidth = WW + 5;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = isSel ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.07)";
      ctx.beginPath(); ctx.moveTo(hx, hy);
      ctx.arc(hx, hy, doorPx, dv.angle, dv.angle + Math.PI / 2);
      ctx.lineTo(hx, hy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = isSel ? "#4ade80" : "#22c55e";
      ctx.lineWidth = isSel ? 2 : 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, doorPx, dv.angle, dv.angle + Math.PI / 2); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.lineCap = "square";
      ctx.fillStyle = isSel ? "#4ade80" : "#22c55e";
      ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
      if (showDimensions) {
        ctx.save(); ctx.font = "9px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = isSel ? "#4ade80" : "#22c55e";
        ctx.fillText(`${dv.width}×${dv.height}m`, (hx + tx) / 2, (hy + ty) / 2 - 10);
        ctx.restore();
      }
    });

    wins.forEach(wv => {
      const isSel = selected?.id === wv.id && selected?.type === "window";
      const cos = Math.cos(wv.angle), sin = Math.sin(wv.angle);
      const winHPx = (wv.width || DEFAULT_WIN_W) * SC / 2;
      const nx = -sin * 4, ny = cos * 4;
      const x1 = wv.x - cos * winHPx, y1 = wv.y - sin * winHPx;
      const x2 = wv.x + cos * winHPx, y2 = wv.y + sin * winHPx;
      ctx.strokeStyle = "#0d1520"; ctx.lineWidth = WW + 5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.fillStyle = isSel ? "rgba(96,165,250,0.26)" : "rgba(96,165,250,0.1)";
      ctx.beginPath();
      ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny);
      ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = isSel ? "#93c5fd" : "#60a5fa";
      ctx.lineWidth = isSel ? 2.5 : 2;
      [[nx, ny], [-nx, -ny]].forEach(([ox, oy]) => {
        ctx.beginPath(); ctx.moveTo(x1 + ox, y1 + oy); ctx.lineTo(x2 + ox, y2 + oy); ctx.stroke();
      });
      ctx.lineWidth = 1.5;
      [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
        ctx.beginPath(); ctx.moveTo(cx + nx, cy + ny); ctx.lineTo(cx - nx, cy - ny); ctx.stroke();
      });
      if (showDimensions) {
        ctx.save(); ctx.font = "9px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = isSel ? "#93c5fd" : "#60a5fa";
        ctx.fillText(`${wv.width}×${wv.height}m`, (x1 + x2) / 2, (y1 + y2) / 2 - 10);
        ctx.restore();
      }
    });

    if (poly.length > 0 && sp) {
      const last = poly[poly.length - 1];
      const closing = poly.length >= 3 && dist(sp, poly[0]) < SR;
      let previewPt = sp;
      if (keyInput) {
        const m = parseFloat(keyInput.replace(/[mM]/g, ""));
        if (!isNaN(m) && m > 0) {
          const dx = sp.x - last.x, dy = sp.y - last.y;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.001) previewPt = { x: last.x + (dx / mag) * m * SC, y: last.y + (dy / mag) * m * SC };
        }
      }
      ctx.strokeStyle = "#2d4a70"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      for (let i = 1; i < poly.length; i++) {
        ctx.beginPath(); ctx.moveTo(poly[i - 1].x, poly[i - 1].y); ctx.lineTo(poly[i].x, poly[i].y); ctx.stroke();
      }
      ctx.strokeStyle = closing ? "#22c55e" : (keyInput ? "#fbbf24" : "#3a5a90");
      ctx.lineWidth = keyInput ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(previewPt.x, previewPt.y); ctx.stroke();
      ctx.setLineDash([]);
      if (closing) {
        ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(poly[0].x, poly[0].y, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(34,197,94,0.25)"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(poly[0].x, poly[0].y, 14, 0, Math.PI * 2); ctx.stroke();
      }
      const pLen = dist(last, previewPt) / SC;
      if (pLen > 0.05) {
        const mx = (last.x + previewPt.x) / 2, my = (last.y + previewPt.y) / 2;
        const angDeg = (Math.atan2(previewPt.y - last.y, previewPt.x - last.x) * 180 / Math.PI).toFixed(1);
        const txt = `${pLen.toFixed(2)} m   ${angDeg}°`;
        const tw = txt.length * 7.4 + 16;
        ctx.fillStyle = "rgba(8,12,22,0.9)";
        roundRect(ctx, mx - tw / 2, my - 24, tw, 18, 4); ctx.fill();
        ctx.fillStyle = keyInput ? "#fbbf24" : "#60a5fa";
        ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
        ctx.fillText(txt, mx, my - 11);
      }
    }

    roomsEnriched.forEach((rm, idx) => {
      const c = centroid(rm.points);
      const ci = rm.colorIdx ?? idx;
      ctx.textAlign = "center";
      ctx.fillStyle = roomHsl(ci); ctx.font = "bold 13px 'Segoe UI',Arial,sans-serif";
      ctx.fillText(rm.name, c.x, c.y - 20);
      ctx.fillStyle = "#4a80b0"; ctx.font = "11px monospace";
      ctx.fillText(`Sol: ${rm.floorArea.toFixed(2)} m²`, c.x, c.y - 5);
      ctx.fillStyle = "#7a60a8"; ctx.font = "10px monospace";
      ctx.fillText(`Vol. : ${rm.volume.toFixed(2)} m³`, c.x, c.y + 10);
      ctx.fillStyle = "#3a6a50"; ctx.font = "10px monospace";
      ctx.fillText(`Murs nets: ${rm.netWallArea.toFixed(2)} m²`, c.x, c.y + 24);
    });

    if (sp) {
      ctx.setLineDash([]); ctx.lineWidth = 2;
      if (sp.type === "ep") {
        ctx.strokeStyle = "#f87171";
        ctx.beginPath(); ctx.rect(sp.x - 6, sp.y - 6, 12, 12); ctx.stroke();
      } else if (sp.type === "mid") {
        ctx.strokeStyle = "#fbbf24";
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y - 7); ctx.lineTo(sp.x + 6, sp.y + 4); ctx.lineTo(sp.x - 6, sp.y + 4); ctx.closePath(); ctx.stroke();
      } else if (sp.type === "onwall") {
        ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(167,139,250,0.25)"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2); ctx.stroke();
      } else if (sp.type === "ortho") {
        ctx.strokeStyle = "#34d399";
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2); ctx.stroke();
        if (poly.length > 0) {
          const L = poly[poly.length - 1];
          ctx.strokeStyle = "rgba(52,211,153,0.18)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.beginPath();
          if (Math.abs(sp.x - L.x) < SR * 1.2) { ctx.moveTo(sp.x, 0); ctx.lineTo(sp.x, H); }
          else { ctx.moveTo(0, sp.y); ctx.lineTo(W, sp.y); }
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (sp.type === "grid") {
        ctx.strokeStyle = "#2a4060"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sp.x - 6, sp.y); ctx.lineTo(sp.x + 6, sp.y);
        ctx.moveTo(sp.x, sp.y - 6); ctx.lineTo(sp.x, sp.y + 6); ctx.stroke();
      }
    }

    if (poly.length > 0) {
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath(); ctx.arc(poly[0].x, poly[0].y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(96,165,250,0.35)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(poly[0].x, poly[0].y, 10, 0, Math.PI * 2); ctx.stroke();
      poly.slice(1, -1).forEach(pt => {
        ctx.fillStyle = "#2a3f58";
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx.fill();
      });
      if (poly.length > 1) {
        ctx.fillStyle = "#80a8d0";
        ctx.beginPath(); ctx.arc(poly[poly.length - 1].x, poly[poly.length - 1].y, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "rgba(8,12,22,0.9)";
      if (ctx.roundRect) ctx.roundRect(8, 8, 200, 22, 4); else ctx.rect(8, 8, 200, 22);
      ctx.fill();
      ctx.fillStyle = "#60a5fa"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left";
      ctx.fillText(`${poly.length} pts · ${polyWallIds.current.length} mur(s)`, 14, 22);
    } else {
      ctx.restore(); 
    }
  }, [walls, wallsEnriched, doors, wins, rooms, roomsEnriched, poly, sp, selected, keyInput, showGrid, showDimensions, bgImage, bgScale, bgOpacity, bgOffsetX, bgOffsetY, pan, canvasSize]);

  const exportSVG = useCallback(() => {
    let s = '<svg viewBox="0 0 840 660" xmlns="http://www.w3.org/2000/svg">';
    s += '<rect width="840" height="660" fill="#0d1520"/>';
    rooms.forEach((rm, i) => {
      const ci = rm.colorIdx ?? i;
      const c = centroid(rm.points);
      const enriched = roomsEnriched.find(r => r.id === rm.id) || rm;
      s += `<polygon points="${rm.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="${roomHsla(ci, 0.15)}" stroke="${roomHsla(ci, 0.5)}" stroke-width="1"/>`;
      s += `<text x="${c.x.toFixed(1)}" y="${(c.y - 10).toFixed(1)}" text-anchor="middle" fill="${roomHsl(ci)}" font-size="13" font-weight="bold" font-family="Arial">${rm.name}</text>`;
      s += `<text x="${c.x.toFixed(1)}" y="${(c.y + 5).toFixed(1)}" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="monospace">Sol: ${(enriched.floorArea||0).toFixed(2)} m²</text>`;
      s += `<text x="${c.x.toFixed(1)}" y="${(c.y + 18).toFixed(1)}" text-anchor="middle" fill="#9070c0" font-size="10" font-family="monospace">Vol. : ${(enriched.volume||0).toFixed(2)} m³</text>`;
    });
    walls.forEach(w => {
      s += `<line x1="${w.x1.toFixed(1)}" y1="${w.y1.toFixed(1)}" x2="${w.x2.toFixed(1)}" y2="${w.y2.toFixed(1)}" stroke="#a8c0d8" stroke-width="5" stroke-linecap="round"/>`;
    });
    s += "</svg>";
    const blob = new Blob([s], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "thermocad.svg"; a.click();
    URL.revokeObjectURL(url);
  }, [walls, rooms, roomsEnriched]);

  // ── NEW: Auto Thermal Bridge Export ──────────────────────────────────
  const handleExport = useCallback(() => {
    if (typeof onExportSurfaces !== "function") {
      console.warn("ThermoCAD: onExportSurfaces prop non fourni.");
      return;
    }
    const data = [
      ...wallsEnriched.map((w) => {
        const ownerCount = rooms.filter(rm => (rm.wallIds || []).includes(w.id)).length;
        // Resolve contact: explicit override wins, then auto-detect from owner count
        const effectiveContact = w.contactOverride && w.contactOverride !== "AUTO"
          ? w.contactOverride
          : ownerCount >= 2 ? "LNC" : "EXT";
        const ownerRoom = rooms.find(rm => (rm.wallIds || []).includes(w.id)) ?? null;
        return {
          id: `cad-wall-${w.id}`,
          group: "vertical",
          elementType: effectiveContact === "LNC" ? "Mur LNC" : "Mur Extérieur",
          contact: effectiveContact,
          width: w.length,
          height: w.height || DEFAULT_H,
          area: w.netArea,
          orientation: getOrientation(w.x1, w.y1, w.x2, w.y2),
          bridgeLength: w.length,
          psi: 0.45,
          // DTR C3.2 default — Double paroi brique (10+air+10)
          composition: DTR_DEFAULT_WALL_PRESET,
          uValue: w.rValue != null ? undefined : DTR_DEFAULT_WALL_U,
          rValue: w.rValue ?? undefined,
          isolantMat:       w.isolantMat       || "aucun",
          isolantEpaisseur: w.isolantEpaisseur || 0.05,
          roomId:   ownerRoom ? ownerRoom.id   : null,
          roomName: ownerRoom ? ownerRoom.name : "Non assigné",
        };
      }),
      ...doors.map((d) => {
        const dw = d.width || DEFAULT_DOOR_W;
        const dh = d.height || DEFAULT_DOOR_H;
        const w = walls.find(wl => wl.id === d.wid);
        const ownerCount = w ? rooms.filter(rm => (rm.wallIds || []).includes(w.id)).length : 0;
        const contact = ownerCount >= 2 ? "LNC" : "EXT";
        const ownerRoom = w ? (rooms.find(rm => (rm.wallIds || []).includes(w.id)) ?? null) : null;
        // Resolve U: use stored doorMat if set, else DTR default for bois 3.2cm (K=3.36)
        const resolvedContact = contact === "LNC" ? "lnc" : "exterieur";
        const uValue = d.uValue ?? (gKP(d.doorMat || DTR_DEFAULT_DOOR_MAT, resolvedContact) || 3.36);
        return {
          id: `cad-door-${d.id}`,
          group: "vertical",
          elementType: "Porte",
          contact,
          width: dw,
          height: dh,
          area: dw * dh,
          uValue,
          orientation: w ? getOrientation(w.x1, w.y1, w.x2, w.y2) : "N",
          bridgeLength: (2 * dh) + dw,
          psi: 0.10,
          roomId:   ownerRoom ? ownerRoom.id   : null,
          roomName: ownerRoom ? ownerRoom.name : "Non assigné",
        };
      }),
      ...wins.map((wv) => {
        const vw = wv.width || DEFAULT_WIN_W;
        const vh = wv.height || DEFAULT_WIN_H;
        const w = walls.find(wl => wl.id === wv.wid);
        const ownerCount = w ? rooms.filter(rm => (rm.wallIds || []).includes(w.id)).length : 0;
        const contact = ownerCount >= 2 ? "LNC" : "EXT";
        const ownerRoom = w ? (rooms.find(rm => (rm.wallIds || []).includes(w.id)) ?? null) : null;
        // Resolve U from stored vitrage params or DTR default (double 10-11mm bois → 3.0)
        const uValue = wv.uValue
          ?? safeNum(gKV(
              wv.winType  || DTR_DEFAULT_WIN_TYPE,
              wv.winLame  || DTR_DEFAULT_WIN_LAME,
              wv.winCadre || DTR_DEFAULT_WIN_CADRE,
             ))
          ?? 3.0;
        return {
          id: `cad-win-${wv.id}`,
          group: "vertical",
          elementType: "Fenêtre",
          contact,
          width: vw,
          height: vh,
          area: vw * vh,
          uValue,
          orientation: w ? getOrientation(w.x1, w.y1, w.x2, w.y2) : "N",
          bridgeLength: 2 * (vw + vh),
          psi: 0.10,
          roomId:   ownerRoom ? ownerRoom.id   : null,
          roomName: ownerRoom ? ownerRoom.name : "Non assigné",
        };
      }),
      // ── Horizontal elements (per room) with thermal bridges ────────────
      ...rooms.map((rm) => {
        const perim = wallsEnriched
          .filter(w => (rm.wallIds || []).includes(w.id))
          .reduce((sum, w) => sum + (w.length || 0), 0);
        return {
          id: `cad-floor-${rm.id}`,
          group: "floor",
          elementType: "Plancher (" + rm.name + ")",
          contact: "SOL",
          area: rm.area || 0,
          perimetre: parseFloat(perim.toFixed(2)),
          z: 0,
          type_iso: "sans_iso",
          composition: DTR_DEFAULT_FLOOR_PRESET,
          uValue: DTR_DEFAULT_FLOOR_U,
          bridgeLength: parseFloat(perim.toFixed(2)),
          psi: 0.45,
          roomId: rm.id,
          roomName: rm.name,
        };
      }),
      ...rooms.map((rm) => {
        const perim = wallsEnriched
          .filter(w => (rm.wallIds || []).includes(w.id))
          .reduce((sum, w) => sum + (w.length || 0), 0);
        return {
          id: `cad-roof-${rm.id}`,
          group: "roof",
          elementType: "Toiture (" + rm.name + ")",
          contact: "EXT",
          area: rm.area || 0,
          composition: DTR_DEFAULT_ROOF_PRESET,
          uValue: DTR_DEFAULT_ROOF_U,
          bridgeLength: parseFloat(perim.toFixed(2)),
          psi: 0.45,
          roomId: rm.id,
          roomName: rm.name,
        };
      }),
    ];
    onExportSurfaces(data);
    setInfo("✅ Exporté avec succès (Ponts auto-calculés) !");
    setTimeout(() => setInfo(""), 2500);
  }, [wallsEnriched, doors, wins, walls, rooms, onExportSurfaces]);

  const S = {
    card: { background: "#0c1a28", borderRadius: 8, padding: "10px 12px", border: "1px solid #152030", marginBottom: 8 },
    label: { color: "#3a5570", fontSize: 10, fontWeight: "700", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" },
    btn: (on, bg = "#1a3050") => ({
      border: "none", padding: "5px 12px", borderRadius: 6,
      cursor: "pointer", fontSize: 12, fontFamily: "'Segoe UI',Arial,sans-serif",
      fontWeight: "600", color: on ? "#fff" : "#5a7898",
      background: on ? bg : "transparent", transition: "all 0.15s", outline: "none", whiteSpace: "nowrap",
    }),
    numIn: (col = "#fbbf24", w = 50) => ({
      width: w, background: "#08101a", border: "1px solid #1a2d40",
      borderRadius: 4, color: col, fontSize: 12, fontFamily: "monospace",
      padding: "2px 4px", outline: "none", textAlign: "center",
    }),
    tab: (on) => ({
      flex: 1, border: "none", padding: "6px 0", borderRadius: 5,
      cursor: "pointer", fontSize: 11, fontWeight: "700",
      color: on ? "#fff" : "#3a5570", background: on ? "#1a3050" : "transparent",
      transition: "all 0.15s", outline: "none",
    }),
  };

  const isDrawing = mode === "wall" && poly.length > 0;
  const activeRoom = roomsEnriched.find(r => r.id === activeReport);
  const canExport =
    typeof onExportSurfaces === "function" &&
    (walls.length > 0 || doors.length > 0 || wins.length > 0);

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#08101a",
      fontFamily: "'Segoe UI',Arial,sans-serif", userSelect: "none",
      overflow: "hidden", color: "#7090a8",
    }}>

      <div style={{
        background: "#0a1520", borderBottom: "1px solid #122030",
        padding: "6px 10px", display: "flex", alignItems: "center",
        gap: 6, flexWrap: "wrap", flexShrink: 0,
      }}>

        <span style={{ color: "#60a5fa", fontWeight: "800", fontSize: 15, marginRight: 2 }}>
          📐 ThermoCAD
        </span>

        <div style={{
          display: "flex", gap: 3,
          background: "rgba(11,17,32,0.80)",
          borderRadius: 10, padding: 4,
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(6px)",
        }}>
          {[
            { id: "wall",   icon: "🧱", label: "Mur",      accent: "#60a5fa" },
            { id: "door",   icon: "🚪", label: "Porte",    accent: "#4ade80" },
            { id: "window", icon: "🪟", label: "Fenêtre",  accent: "#38bdf8" },
            { id: "select", icon: "✏️", label: "Modifier", accent: "#c084fc" },
          ].map(m => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                data-pressed={isActive ? "true" : "false"}
                className="nt-pressable"
                onClick={() => {
                  setMode(m.id);
                  setPoly([]);
                  setKeyInput("");
                  setSelected(null);
                  polyWallIds.current = [];
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "'Segoe UI',Arial,sans-serif",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  outline: "none",
                  color: isActive ? m.accent : "#5a7898",
                  border: isActive
                    ? `1px solid ${m.accent}55`
                    : "1px solid transparent",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "#0c1828", borderRadius: 8, padding: "4px 10px", border: "1px solid #162030",
        }}>
          <span style={{ fontSize: 11 }}>↕ Hauteur :</span>
          <input type="number" min="0.5" max="10" step="0.1"
            value={globalHeight}
            onChange={e => setGlobalHeight(parseFloat(e.target.value) || DEFAULT_H)}
            style={S.numIn()}
          />
          <span style={{ fontSize: 11 }}>m</span>
          <button onClick={applyHeightToAll} style={{
            ...S.btn(false), padding: "3px 8px", fontSize: 10,
            color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 5,
          }}>↓ Tout</button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: isDrawing ? "rgba(251,191,36,0.07)" : "#0c1828",
          borderRadius: 8, padding: "4px 10px",
          border: `1px solid ${isDrawing ? "rgba(251,191,36,0.35)" : "#162030"}`,
          opacity: isDrawing ? 1 : 0.4, transition: "all 0.2s",
        }}>
          <span style={{ fontSize: 11, color: isDrawing ? "#fbbf24" : "#5a7898" }}>📐 Longueur :</span>
          <input
            ref={keyInputRef}
            type="text" inputMode="decimal"
            placeholder={isDrawing ? "Saisir..." : "—"}
            value={keyInput}
            disabled={!isDrawing}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              if ((v.match(/\./g) || []).length <= 1) setKeyInput(v);
            }}
            onKeyDown={e => {
              if (e.key === "Enter") { commitTypedLength(); e.preventDefault(); }
              if (e.key === "Escape") { setKeyInput(""); e.preventDefault(); }
            }}
            style={{
              width: 65, background: "transparent", border: "none",
              borderBottom: `1px solid ${isDrawing ? "#fbbf24" : "#2a3f58"}`,
              color: "#fbbf24", fontSize: 13, fontFamily: "monospace",
              padding: "2px 4px", outline: "none", textAlign: "center", fontWeight: "700",
            }}
          />
          <span style={{ fontSize: 11 }}>m</span>
          <button disabled={!isDrawing || !keyInput} onClick={commitTypedLength}
            style={{
              background: keyInput && isDrawing ? "#fbbf24" : "#1a2d40",
              color: keyInput && isDrawing ? "#111" : "#2a3f58",
              border: "none", borderRadius: 4, padding: "3px 8px",
              fontSize: 11, fontWeight: "700", cursor: keyInput ? "pointer" : "default", transition: "all 0.15s",
            }}>✓</button>
        </div>

        <button onClick={() => setShowGrid(!showGrid)} style={{
          ...S.btn(showGrid, "#1a3050"), padding: "5px 10px", fontSize: 11,
          border: "1px solid rgba(96,165,250,0.2)", color: showGrid ? "#60a5fa" : "#2a3f58",
        }}>⊞ Grille</button>

        <button onClick={() => setShowDimensions(!showDimensions)} style={{
          ...S.btn(showDimensions, "#1a3050"), padding: "5px 10px", fontSize: 11,
          border: "1px solid rgba(200,216,240,0.2)", color: showDimensions ? "#c8d8f0" : "#2a3f58",
        }}>📏 Cotes</button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...S.btn(!!bgImage, "#1a3050"), padding: "5px 10px", fontSize: 11,
            border: "1px solid rgba(251,191,36,0.25)",
            color: bgImage ? "#fbbf24" : "#5a7898",
          }}
        >🖼️ Insérer plan</button>

        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{
            color: "#fbbf24", fontSize: 12, fontWeight: "600",
            background: "rgba(251,191,36,0.07)", padding: "4px 14px",
            borderRadius: 20, border: "1px solid rgba(251,191,36,0.12)", display: "inline-block",
          }}>
            {keyInput ? `⌨ ${keyInput} m  —  Entrée` : info || (
              mode === "wall"   ? "Cliquer pour tracer · Esc pour annuler" :
              mode === "door"   ? "Cliquer sur un mur pour placer une porte" :
              mode === "window" ? "Cliquer sur un mur pour placer une fenêtre" :
                                  "Cliquer pour sélectionner un élément"
            )}
          </span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={undo} disabled={!undoStack.length} style={{
            ...S.btn(false), padding: "5px 9px", fontSize: 11,
            color: undoStack.length ? "#93c5fd" : "#1e3050", border: "1px solid #1a2d40",
          }}>↩</button>
          <button onClick={redo} disabled={!redoStack.length} style={{
            ...S.btn(false), padding: "5px 9px", fontSize: 11,
            color: redoStack.length ? "#93c5fd" : "#1e3050", border: "1px solid #1a2d40",
          }}>↪</button>
          <button onClick={exportSVG} style={{
            ...S.btn(false), color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", padding: "5px 9px", fontSize: 11,
          }}>💾 SVG</button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            title={canExport ? "Exporter les murs et ouvertures vers DTR" : "Aucun élément à exporter"}
            style={{
              ...S.btn(false),
              padding: "5px 10px", fontSize: 11, fontWeight: "700",
              color: canExport ? "#fff" : "#2a3f58",
              background: canExport ? "#f59e0b" : "transparent",
              border: `1px solid ${canExport ? "#f59e0b" : "#1a2d40"}`,
              cursor: canExport ? "pointer" : "not-allowed",
              opacity: canExport ? 1 : 0.5,
            }}
          >📤 Exporter vers Calculs</button>
          <button onClick={() => {
            const snap = getSnapshot(); pushUndo(snap);
            setWalls([]); setDoors([]); setWins([]); setRooms([]);
            setPoly([]); setSelected(null); setKeyInput(""); setInfo(""); setActiveReport(null);
            wRef.current = 0; rRef.current = 0; polyWallIds.current = [];
          }} style={{ ...S.btn(false), color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", padding: "5px 9px", fontSize: 11 }}>🗑</button>
        </div>
      </div>

      {bgImage && (
        <div style={{
          background: "linear-gradient(180deg, #0b1a2a 0%, #091420 100%)",
          borderBottom: "1px solid #122030",
          padding: "8px 10px", display: "flex", alignItems: "center",
          gap: 14, flexWrap: "wrap", flexShrink: 0, fontSize: 11,
        }}>
          <span style={{
            color: "#fbbf24", fontWeight: "800", letterSpacing: "0.03em",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            🖼️ <span>Calibration du plan</span>
          </span>

            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#7090a8" }}>
            <span style={{ minWidth: 44 }}>Opacité</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={bgOpacity}
              onChange={e => setBgOpacity(parseFloat(e.target.value))}
              style={{ width: 130 }}
            />
            <span style={{ color: "#fbbf24", fontFamily: "monospace", width: 40, textAlign: "right" }}>
              {Math.round(bgOpacity * 100)}%
            </span>
          </label>

            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#7090a8" }}>
            <span style={{ minWidth: 44 }}>Échelle</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.01"
              value={bgScale}
              onChange={e => setBgScale(parseFloat(e.target.value))}
              style={{ width: 130 }}
            />
            <span style={{ color: "#fbbf24", fontFamily: "monospace", width: 48, textAlign: "right" }}>
              {bgScale.toFixed(2)}×
            </span>
          </label>

          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "#0c1828", borderRadius: 8, padding: "3px 8px",
            border: "1px solid #162030",
          }}>
            <span style={{ color: "#7090a8", marginRight: 4 }}>Position</span>
            <button title="Gauche" onClick={() => setBgOffsetX(v => v - NUDGE_STEP)} style={nudgeBtnStyle}>←</button>
            <button title="Haut"   onClick={() => setBgOffsetY(v => v - NUDGE_STEP)} style={nudgeBtnStyle}>↑</button>
            <button title="Bas"    onClick={() => setBgOffsetY(v => v + NUDGE_STEP)} style={nudgeBtnStyle}>↓</button>
            <button title="Droite" onClick={() => setBgOffsetX(v => v + NUDGE_STEP)} style={nudgeBtnStyle}>→</button>
            <span style={{
              color: "#fbbf24", fontFamily: "monospace",
              fontSize: 10, marginLeft: 6, minWidth: 74, textAlign: "right",
            }}>
              {Math.round(bgOffsetX)},{Math.round(bgOffsetY)}
            </span>
          </div>

          <button
            onClick={() => setBgImage(null)}
            title="Supprimer le plan"
            style={{
              marginLeft: "auto",
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.5)",
              borderRadius: 4,
              padding: "4px 12px",
              color: "#f87171",
              fontSize: 13,
              fontWeight: "800",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >✖</button>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Canvas occupies all space left of the right panel */}
        <div ref={cvsWrapRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <canvas
            ref={cvs}
            width={canvasSize.w}
            height={canvasSize.h}
            onMouseDown={onMouseDown}
            onMouseMove={onMove}
            onClick={onClick}
            onDoubleClick={() => { setPoly([]); setInfo(""); setKeyInput(""); polyWallIds.current = []; }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{ display: "block", cursor: isPanningRef.current ? "grabbing" : isSpacePanRef.current ? "grab" : mode === "select" ? "default" : "crosshair" }}
          />
        </div>

        <div style={{
          width: 270, background: "#08101a", borderLeft: "1px solid #101e2e",
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        }}>

          <div style={{
            display: "flex", gap: 3, padding: "8px 10px 4px",
            borderBottom: "1px solid #101e2e", flexShrink: 0,
          }}>
            {[
              { id: "rooms",    label: "🏠 Pièces" },
              { id: "walls",    label: "🧱 Murs" },
              { id: "openings", label: "🚪🪟 Ouvertures" },
              { id: "props",    label: "✏️ Propriétés" },
            ].map(t => (
              <button key={t.id} style={S.tab(activeTab === t.id)}
                onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>

            <div style={S.card}>
              <div style={S.label}>📊 Résumé du projet</div>
              <StatRow label="Murs"    val={walls.length} col="#c8d8f0" />
              <StatRow label="Portes"  val={doors.length} col="#4ade80" />
              <StatRow label="Fenêtres" val={wins.length} col="#60a5fa" />
              <StatRow label="Pièces"  val={rooms.length} col="#c084fc" />
              <div style={{ borderTop: "1px solid #101e2e", marginTop: 6, paddingTop: 6 }} />
              <StatRow label="Murs (brut)" val={`${totals.grossWall.toFixed(2)} m²`} col="#a78bfa"
                sub={`Net: ${totals.netWall.toFixed(2)} m²`} />
              <StatRow label="Planchers"   val={`${totals.floor.toFixed(2)} m²`} col="#fbbf24" />
              <StatRow label="Volume total" val={`${totals.volume.toFixed(2)} m³`} col="#34d399" />
              <StatRow label="Total fenêtres" val={`${totals.windows.toFixed(2)} m²`} col="#7dd3fc" />
              <StatRow label="Total portes"   val={`${totals.doors.toFixed(2)} m²`} col="#86efac" />
            </div>

            {activeTab === "rooms" && (
              <div>
                <div style={S.label}>🏠 Pièces détectées</div>
                {rooms.length === 0 ? (
                  <div style={{ color: "#1e3050", fontSize: 12, padding: "12px 0", textAlign: "center" }}>
                    Fermez un polygone de murs pour créer une pièce
                  </div>
                ) : (
                  roomsEnriched.map((rm, idx) => {
                    const ci = rm.colorIdx ?? idx;
                    const isOpen = activeReport === rm.id;
                    return (
                      <div key={rm.id} style={{
                        ...S.card,
                        borderLeft: `3px solid ${roomHsl(ci)}`,
                        cursor: "pointer", transition: "background 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}
                          onClick={() => setActiveReport(isOpen ? null : rm.id)}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: roomHsl(ci), flexShrink: 0 }} />
                          <input
                            value={rm.name}
                            onChange={e => setRooms(prev => prev.map(r => r.id === rm.id ? { ...r, name: e.target.value } : r))}
                            onClick={e => e.stopPropagation()}
                            style={{
                              flex: 1, background: "transparent", border: "none",
                              borderBottom: "1px solid #152030", color: roomHsl(ci),
                              fontSize: 12, fontFamily: "'Segoe UI',Arial,sans-serif",
                              outline: "none", fontWeight: "700", paddingBottom: 2,
                            }}
                          />
                          <span style={{ color: "#2a3f58", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                          <button onClick={e => { e.stopPropagation(); const snap = getSnapshot(); pushUndo(snap); setRooms(prev => prev.filter(r => r.id !== rm.id)); if (activeReport === rm.id) setActiveReport(null); }}
                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                          <span style={{ color: "#3a5570", fontSize: 10 }}>Hauteur de pièce :</span>
                          <input type="number" min="0.5" max="10" step="0.1"
                            value={rm.roomHeight}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updateRoomHeight(rm.id, e.target.value)}
                            style={S.numIn("#fbbf24", 46)}
                          />
                          <span style={{ color: "#3a5570", fontSize: 10 }}>m</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                          {[
                            { label: "Sol",         val: `${rm.floorArea.toFixed(2)} m²`,      col: "#fbbf24" },
                            { label: "Volume",      val: `${rm.volume.toFixed(2)} m³`,          col: "#c084fc" },
                            { label: "Murs (brut)", val: `${rm.grossWallArea.toFixed(2)} m²`,   col: "#a78bfa" },
                            { label: "Murs (net)",  val: `${rm.netWallArea.toFixed(2)} m²`,     col: "#34d399" },
                          ].map(item => (
                            <div key={item.label} style={{
                              background: "#0a1422", borderRadius: 5, padding: "5px 7px",
                              border: "1px solid #101e2e",
                            }}>
                              <div style={{ color: "#2a3f58", fontSize: 9, marginBottom: 2 }}>{item.label}</div>
                              <div style={{ color: item.col, fontSize: 11, fontFamily: "monospace", fontWeight: "700" }}>{item.val}</div>
                            </div>
                          ))}
                        </div>

                        {isOpen && (
                          <div style={{
                            marginTop: 8, borderTop: "1px solid #101e2e", paddingTop: 8,
                            background: "#080e18", borderRadius: 6, padding: 8,
                          }}>
                            <div style={{ color: "#2a5a8a", fontSize: 10, fontWeight: "700", marginBottom: 6 }}>
                              📋 Rapport thermique complet
                            </div>
                            <StatRow label="Superficie sol"     val={`${rm.floorArea.toFixed(3)} m²`}  col="#fbbf24" />
                            <StatRow label="Superficie plafond" val={`${rm.ceilingArea.toFixed(3)} m²`} col="#fbbf24" />
                            <StatRow label="Hauteur de pièce"   val={`${rm.roomHeight.toFixed(2)} m`}   col="#c8d8f0" />
                            <StatRow label="Volume"             val={`${rm.volume.toFixed(3)} m³`}       col="#c084fc" />
                            <div style={{ borderTop: "1px solid #101e2e", margin: "5px 0" }} />
                            <StatRow label="Murs (brut)"  val={`${rm.grossWallArea.toFixed(3)} m²`} col="#a78bfa" sub={`${rm.wallCount} mur(s)`} />
                            <StatRow label="Ouvertures"   val={`${(rm.windowArea + rm.doorArea).toFixed(3)} m²`} col="#f87171" />
                            <StatRow label="Murs (net)"   val={`${rm.netWallArea.toFixed(3)} m²`} col="#34d399" />
                            <div style={{ borderTop: "1px solid #101e2e", margin: "5px 0" }} />
                            <StatRow label="Fenêtres" val={`${rm.windowArea.toFixed(3)} m²`} col="#60a5fa" sub={`${rm.windowCount} fenêtre(s)`} />
                            <StatRow label="Portes"   val={`${rm.doorArea.toFixed(3)} m²`}   col="#4ade80" sub={`${rm.doorCount} porte(s)`} />
                            <div style={{ borderTop: "1px solid #101e2e", margin: "5px 0" }} />
                            <StatRow label="Total surfaces (brut)" val={`${rm.totalGrossSurface.toFixed(3)} m²`} col="#f59e0b" />
                            <StatRow label="Surfaces nettes"       val={`${rm.totalNetSurface.toFixed(3)} m²`}  col="#22c55e" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "walls" && (
              <div>
                <div style={S.label}>🧱 Liste des murs</div>
                {walls.length === 0 ? (
                  <div style={{ color: "#1e3050", fontSize: 12, padding: "12px 0", textAlign: "center" }}>Aucun mur</div>
                ) : (
                  wallsEnriched.map((w, i) => {
                    const isSel = selected?.id === w.id;
                    return (
                      <div key={w.id} style={{
                        ...S.card, marginBottom: 5,
                        borderLeft: `3px solid ${isSel ? "#fbbf24" : "#1e3a5f"}`,
                        background: isSel ? "rgba(251,191,36,0.04)" : "#0c1a28",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ color: isSel ? "#fbbf24" : "#3a5570", fontSize: 11, fontWeight: "700" }}>
                            Mur {i + 1}
                          </span>
                          <span style={{ color: "#60a5fa", fontSize: 11, fontFamily: "monospace" }}>
                            {w.length.toFixed(2)} m
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                          <span style={{ color: "#2a3f58", fontSize: 10 }}>Hauteur :</span>
                          <input type="number" min="0.5" max="10" step="0.1"
                            value={w.height}
                            onChange={e => updateWallHeight(w.id, e.target.value)}
                            style={S.numIn("#fbbf24", 46)}
                          />
                          <span style={{ color: "#2a3f58", fontSize: 10 }}>m</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
                          <div style={{ background: "#080e18", borderRadius: 4, padding: "4px 5px", border: "1px solid #101e2e" }}>
                            <div style={{ color: "#2a3f58", fontSize: 9 }}>Brut</div>
                            <div style={{ color: "#a78bfa", fontSize: 10, fontFamily: "monospace" }}>{w.grossArea.toFixed(2)}</div>
                          </div>
                          <div style={{ background: "#080e18", borderRadius: 4, padding: "4px 5px", border: "1px solid #101e2e" }}>
                            <div style={{ color: "#2a3f58", fontSize: 9 }}>Ouv.</div>
                            <div style={{ color: "#f87171", fontSize: 10, fontFamily: "monospace" }}>{w.openingArea.toFixed(2)}</div>
                          </div>
                          <div style={{ background: "#080e18", borderRadius: 4, padding: "4px 5px", border: "1px solid #101e2e" }}>
                            <div style={{ color: "#2a3f58", fontSize: 9 }}>Net</div>
                            <div style={{ color: "#34d399", fontSize: 10, fontFamily: "monospace" }}>{w.netArea.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {walls.length > 0 && (
                  <div style={{ ...S.card, background: "#06100e", borderColor: "#0f2a1a" }}>
                    <StatRow label="Total murs (brut)" val={`${totals.grossWall.toFixed(2)} m²`} col="#a78bfa" />
                    <StatRow label="Total murs (net)"  val={`${totals.netWall.toFixed(2)} m²`}  col="#34d399" />
                  </div>
                )}
              </div>
            )}

            {activeTab === "openings" && (
              <div>
                <div style={S.label}>🚪 Portes</div>
                {doors.length === 0 ? (
                  <div style={{ color: "#1e3050", fontSize: 12, textAlign: "center", padding: "8px 0" }}>Aucune porte</div>
                ) : (
                  doors.map((d, i) => {
                    const isSel = selected?.id === d.id;
                    return (
                      <div key={d.id} style={{
                        ...S.card, marginBottom: 5,
                        borderLeft: `3px solid ${isSel ? "#4ade80" : "#15803d"}`,
                        background: isSel ? "rgba(74,222,128,0.04)" : "#0c1a28",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ color: "#4ade80", fontSize: 11, fontWeight: "700" }}>Porte {i + 1}</span>
                          <span style={{ color: "#34d399", fontSize: 11, fontFamily: "monospace" }}>{d.area.toFixed(3)} m²</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ color: "#2a3f58", fontSize: 10 }}>Larg. :</span>
                            <input type="number" min="0.3" max="3" step="0.05"
                              value={d.width}
                              onChange={e => updateDoor(d.id, "width", e.target.value)}
                              style={S.numIn("#4ade80", 44)}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ color: "#2a3f58", fontSize: 10 }}>Haut. :</span>
                            <input type="number" min="0.5" max="5" step="0.05"
                              value={d.height}
                              onChange={e => updateDoor(d.id, "height", e.target.value)}
                              style={S.numIn("#4ade80", 44)}
                            />
                          </div>
                        </div>
                        <div style={{ color: "#1a3028", fontSize: 9, marginTop: 4 }}>
                          {d.width.toFixed(2)}m × {d.height.toFixed(2)}m = {d.area.toFixed(3)} m²
                        </div>
                      </div>
                    );
                  })
                )}

                <div style={{ ...S.label, marginTop: 8 }}>🪟 Fenêtres</div>
                {wins.length === 0 ? (
                  <div style={{ color: "#1e3050", fontSize: 12, textAlign: "center", padding: "8px 0" }}>Aucune fenêtre</div>
                ) : (
                  wins.map((wv, i) => {
                    const isSel = selected?.id === wv.id;
                    return (
                      <div key={wv.id} style={{
                        ...S.card, marginBottom: 5,
                        borderLeft: `3px solid ${isSel ? "#93c5fd" : "#0e7490"}`,
                        background: isSel ? "rgba(147,197,253,0.04)" : "#0c1a28",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: "700" }}>Fenêtre {i + 1}</span>
                          <span style={{ color: "#38bdf8", fontSize: 11, fontFamily: "monospace" }}>{wv.area.toFixed(3)} m²</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ color: "#2a3f58", fontSize: 10 }}>Larg. :</span>
                            <input type="number" min="0.3" max="4" step="0.05"
                              value={wv.width}
                              onChange={e => updateWindow(wv.id, "width", e.target.value)}
                              style={S.numIn("#60a5fa", 44)}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ color: "#2a3f58", fontSize: 10 }}>Haut. :</span>
                            <input type="number" min="0.3" max="3" step="0.05"
                              value={wv.height}
                              onChange={e => updateWindow(wv.id, "height", e.target.value)}
                              style={S.numIn("#60a5fa", 44)}
                            />
                          </div>
                        </div>
                        <div style={{ color: "#0e3a50", fontSize: 9, marginTop: 4 }}>
                          {wv.width.toFixed(2)}m × {wv.height.toFixed(2)}m = {wv.area.toFixed(3)} m²
                        </div>
                      </div>
                    );
                  })
                )}

                {(doors.length > 0 || wins.length > 0) && (
                  <div style={{ ...S.card, background: "#06100e", borderColor: "#0f2a1a" }}>
                    <StatRow label="Total portes"    val={`${totals.doors.toFixed(3)} m²`}                col="#4ade80" />
                    <StatRow label="Total fenêtres"  val={`${totals.windows.toFixed(3)} m²`}             col="#60a5fa" />
                    <StatRow label="Total ouvertures" val={`${(totals.doors + totals.windows).toFixed(3)} m²`} col="#f87171" />
                  </div>
                )}
              </div>
            )}

            {activeTab === "props" && (
              <div>
                <div style={S.label}>✏️ Propriétés</div>
                {!selected ? (
                  <div style={{ color: "#1e3050", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                    Passez en mode Modifier puis cliquez sur un élément
                  </div>
                ) : selectedEl ? (
                  <div>
                    <div style={{ ...S.card, borderLeft: `3px solid ${selected.type === "wall" ? "#fbbf24" : selected.type === "door" ? "#4ade80" : "#60a5fa"}` }}>
                      <div style={{ color: "#c8d8f0", fontSize: 13, fontWeight: "700", marginBottom: 10 }}>
                        {selected.type === "wall" ? "🧱 Mur" : selected.type === "door" ? "🚪 Porte" : "🪟 Fenêtre"}
                        <span style={{ color: "#2a3f58", fontSize: 10, marginRight: 6 }}> — {selectedEl.id}</span>
                      </div>

                      {selected.type === "wall" && (() => {
                        const w = selectedEl;
                        const wallPreset = w.composition || DTR_DEFAULT_WALL_PRESET;
                        const isManualWall = wallPreset === "manuel" || !PRESETS_MURS.some(p => p.val === wallPreset);
                        const resolvedPreset = isManualWall ? "manuel" : wallPreset;
                        return (
                          <div>
                            <StatRow label="Longueur" val={`${w.length.toFixed(3)} m`} col="#60a5fa" />
                            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0" }}>
                              <span style={{ color: "#3a5570", fontSize: 11 }}>Hauteur :</span>
                              <input type="number" min="0.5" max="10" step="0.1"
                                value={w.height}
                                onChange={e => updateWallHeight(w.id, e.target.value)}
                                style={S.numIn("#fbbf24", 54)}
                              />
                              <span style={{ color: "#3a5570", fontSize: 11 }}>m</span>
                            </div>
                            <StatRow label="Surface brute"  val={`${w.grossArea.toFixed(3)} m²`} col="#a78bfa" />
                            <StatRow label="Ouvertures"     val={`${w.openingArea.toFixed(3)} m²`} col="#f87171" />
                            <StatRow label="Surface nette"  val={`${w.netArea.toFixed(3)} m²`} col="#34d399" />

                            {/* NOUVEAU: Isolation Thermique */}
                            <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #1f3248" }}>
                              <div style={{ color: "#4a6a8a", fontSize: 10, marginBottom: 4 }}>Isolation (Optionnel)</div>
                              <select
                                value={w.isolantMat || "aucun"}
                                onChange={e => setWalls(prev => prev.map(x => x.id !== w.id ? x : { ...x, isolantMat: e.target.value }))}
                                style={{
                                  width: "100%", background: "#122032", border: "1px solid #1f3248",
                                  borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px", marginBottom: 6
                                }}
                              >
                                {ISOLANT_OPTS.map(o => (
                                  <option key={o.val} value={o.val}>{o.label}</option>
                                ))}
                              </select>
                              {w.isolantMat && w.isolantMat !== "aucun" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ color: "#3a5570", fontSize: 10 }}>Épaisseur:</span>
                                  <input type="number" min="0.01" max="0.5" step="0.01"
                                    value={w.isolantEpaisseur || 0.05}
                                    onChange={e => setWalls(prev => prev.map(x => x.id !== w.id ? x : { ...x, isolantEpaisseur: parseFloat(e.target.value) || 0 }))}
                                    style={{
                                      width: 60, background: "#08101a", border: "1px solid #1a2d40",
                                      borderRadius: 4, color: "#fbbf24", fontSize: 11, padding: "2px 4px", textAlign: "center"
                                    }}
                                  />
                                  <span style={{ color: "#3a5570", fontSize: 10 }}>m</span>
                                </div>
                              )}
                            </div>

                            {/* DTR C3.2 — Wall material preset */}
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #1f3248" }}>
                              <div style={{ color: "#4a6a8a", fontSize: 10, marginBottom: 4 }}>Matériau (DTR C3.2)</div>
                              <select
                                value={resolvedPreset}
                                onChange={e => {
                                  const val = e.target.value;
                                  const preset = PRESETS_MURS.find(p => p.val === val);
                                  setWalls(prev => prev.map(x => x.id !== w.id ? x : {
                                    ...x,
                                    composition: val,
                                    ...(preset && preset.u !== "" ? { uValue: preset.u } : {}),
                                  }));
                                }}
                                style={{
                                  width: "100%", background: "#122032", border: "1px solid #1f3248",
                                  borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px",
                                }}
                              >
                                {PRESETS_MURS.map(p => (
                                  <option key={p.val} value={p.val}>{p.label}</option>
                                ))}
                              </select>
                              {resolvedPreset !== "manuel" && safeNum(w.uValue) !== null && (
                                <div style={{ color: "#60a5fa", fontSize: 11, fontFamily: "monospace", marginTop: 4 }}>
                                  U = {Number(w.uValue).toFixed(2)} W/m²K
                                </div>
                              )}
                              {resolvedPreset === "manuel" && (
                                <input type="number" min="0.01" max="10" step="0.01"
                                  value={w.uValue ?? ""}
                                  onChange={e => setWalls(prev => prev.map(x => x.id !== w.id ? x : { ...x, uValue: Number(e.target.value) }))}
                                  placeholder="U manuel (W/m²K)"
                                  style={{
                                    width: "100%", background: "#122032", border: "1px solid #1f3248",
                                    borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px", marginTop: 4,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {selected.type === "door" && (() => {
                        const d = selectedEl;
                        const doorMat = d.doorMat || DTR_DEFAULT_DOOR_MAT;
                        const doorContact = (d.contact || "EXT").toUpperCase() === "LNC" ? "lnc" : "exterieur";
                        const autoK = doorMat !== "manuel" ? safeNum(gKP(doorMat, doorContact)) : null;
                        return (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ color: "#3a5570", fontSize: 11 }}>Largeur :</span>
                              <input type="number" min="0.3" max="3" step="0.05"
                                value={d.width}
                                onChange={e => updateDoor(d.id, "width", e.target.value)}
                                style={S.numIn("#4ade80", 54)}
                              />
                              <span style={{ color: "#3a5570", fontSize: 11 }}>m</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ color: "#3a5570", fontSize: 11 }}>Hauteur :</span>
                              <input type="number" min="0.5" max="5" step="0.05"
                                value={d.height}
                                onChange={e => updateDoor(d.id, "height", e.target.value)}
                                style={S.numIn("#4ade80", 54)}
                              />
                              <span style={{ color: "#3a5570", fontSize: 11 }}>m</span>
                            </div>
                            <StatRow label="Surface" val={`${d.area.toFixed(3)} m²`} col="#4ade80" />

                            {/* DTR C3.2 — Door material + contact */}
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #1f3248" }}>
                              <div style={{ color: "#4a6a8a", fontSize: 10, marginBottom: 4 }}>Matériau / Type (DTR C3.2)</div>
                              <select
                                value={doorMat}
                                onChange={e => {
                                  const val = e.target.value;
                                  const u = val !== "manuel" ? safeNum(gKP(val, doorContact)) : null;
                                  setDoors(prev => prev.map(x => x.id !== d.id ? x : {
                                    ...x, doorMat: val, ...(u !== null ? { uValue: u } : {}),
                                  }));
                                }}
                                style={{
                                  width: "100%", background: "#122032", border: "1px solid #1f3248",
                                  borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px",
                                }}
                              >
                                {MATERIAU_OPTS.map(o => (
                                  <option key={o.val} value={o.val}>{o.label}</option>
                                ))}
                              </select>

                              <div style={{ color: "#4a6a8a", fontSize: 10, margin: "6px 0 4px 0" }}>Contact</div>
                              <select
                                value={(d.contact || "EXT").toUpperCase()}
                                onChange={e => {
                                  const newC = e.target.value;
                                  const ct = newC === "LNC" ? "lnc" : "exterieur";
                                  const u = doorMat !== "manuel" ? safeNum(gKP(doorMat, ct)) : null;
                                  setDoors(prev => prev.map(x => x.id !== d.id ? x : {
                                    ...x, contact: newC, ...(u !== null ? { uValue: u } : {}),
                                  }));
                                }}
                                style={{
                                  width: "100%", background: "#122032", border: "1px solid #1f3248",
                                  borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px",
                                }}
                              >
                                <option value="EXT">Extérieur</option>
                                <option value="LNC">Local Non Chauffé (LNC)</option>
                              </select>

                              {doorMat !== "manuel" && autoK !== null && (
                                <div style={{ color: "#4ade80", fontSize: 11, fontFamily: "monospace", marginTop: 6 }}>
                                  K = {autoK.toFixed(2)} W/m²K
                                </div>
                              )}
                              {doorMat === "manuel" && (
                                <input type="number" min="0.01" max="10" step="0.01"
                                  value={d.uValue ?? ""}
                                  onChange={e => setDoors(prev => prev.map(x => x.id !== d.id ? x : { ...x, uValue: Number(e.target.value) }))}
                                  placeholder="K manuel (W/m²K)"
                                  style={{
                                    width: "100%", background: "#122032", border: "1px solid #1f3248",
                                    borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px", marginTop: 6,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {selected.type === "window" && (() => {
                        const wv = selectedEl;
                        const winType  = wv.winType  || DTR_DEFAULT_WIN_TYPE;
                        const winLame  = wv.winLame  || DTR_DEFAULT_WIN_LAME;
                        const winCadre = wv.winCadre || DTR_DEFAULT_WIN_CADRE;
                        const showLame = winType === "double";
                        const autoK    = winType !== "manuel" ? safeNum(gKV(winType, winLame, winCadre)) : null;

                        const updateWin = (patch) => {
                          setWins(prev => prev.map(x => x.id !== wv.id ? x : { ...x, ...patch }));
                        };

                        return (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ color: "#3a5570", fontSize: 11 }}>Largeur :</span>
                              <input type="number" min="0.3" max="4" step="0.05"
                                value={wv.width}
                                onChange={e => updateWindow(wv.id, "width", e.target.value)}
                                style={S.numIn("#60a5fa", 54)}
                              />
                              <span style={{ color: "#3a5570", fontSize: 11 }}>m</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ color: "#3a5570", fontSize: 11 }}>Hauteur :</span>
                              <input type="number" min="0.3" max="3" step="0.05"
                                value={wv.height}
                                onChange={e => updateWindow(wv.id, "height", e.target.value)}
                                style={S.numIn("#60a5fa", 54)}
                              />
                              <span style={{ color: "#3a5570", fontSize: 11 }}>m</span>
                            </div>
                            <StatRow label="Surface" val={`${wv.area.toFixed(3)} m²`} col="#60a5fa" />

                            {/* DTR C3.2 — Window vitrage / lame / cadre */}
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #1f3248" }}>
                              <div style={{ color: "#4a6a8a", fontSize: 10, marginBottom: 4 }}>Vitrage (DTR C3.2)</div>
                              <select
                                value={winType}
                                onChange={e => {
                                  const val = e.target.value;
                                  const u = val !== "manuel" ? safeNum(gKV(val, winLame, winCadre)) : null;
                                  updateWin({ winType: val, ...(u !== null ? { uValue: u } : {}) });
                                }}
                                style={{
                                  width: "100%", background: "#122032", border: "1px solid #1f3248",
                                  borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px",
                                }}
                              >
                                {VITRAGE_OPTS.map(o => (
                                  <option key={o.val} value={o.val}>{o.label}</option>
                                ))}
                              </select>

                              {showLame && winType !== "manuel" && (
                                <>
                                  <div style={{ color: "#4a6a8a", fontSize: 10, margin: "6px 0 4px 0" }}>Lame d&apos;air</div>
                                  <select
                                    value={winLame}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const u = safeNum(gKV(winType, val, winCadre));
                                      updateWin({ winLame: val, ...(u !== null ? { uValue: u } : {}) });
                                    }}
                                    style={{
                                      width: "100%", background: "#122032", border: "1px solid #1f3248",
                                      borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px",
                                    }}
                                  >
                                    {LAME_OPTS.map(o => (
                                      <option key={o.val} value={o.val}>{o.label}</option>
                                    ))}
                                  </select>
                                </>
                              )}

                              {winType !== "manuel" && (
                                <>
                                  <div style={{ color: "#4a6a8a", fontSize: 10, margin: "6px 0 4px 0" }}>Cadre</div>
                                  <select
                                    value={winCadre}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const u = safeNum(gKV(winType, winLame, val));
                                      updateWin({ winCadre: val, ...(u !== null ? { uValue: u } : {}) });
                                    }}
                                    style={{
                                      width: "100%", background: "#122032", border: "1px solid #1f3248",
                                      borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px",
                                    }}
                                  >
                                    {CADRE_OPTS.map(o => (
                                      <option key={o.val} value={o.val}>{o.label}</option>
                                    ))}
                                  </select>
                                </>
                              )}

                              {winType !== "manuel" && autoK !== null && (
                                <div style={{ color: "#60a5fa", fontSize: 11, fontFamily: "monospace", marginTop: 6 }}>
                                  K = {autoK.toFixed(2)} W/m²K
                                </div>
                              )}
                              {winType === "manuel" && (
                                <input type="number" min="0.01" max="10" step="0.01"
                                  value={wv.uValue ?? ""}
                                  onChange={e => updateWin({ uValue: Number(e.target.value) })}
                                  placeholder="K manuel (W/m²K)"
                                  style={{
                                    width: "100%", background: "#122032", border: "1px solid #1f3248",
                                    borderRadius: 4, color: "#cbd5e1", fontSize: 11, padding: "4px 6px", marginTop: 6,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      <button onClick={deleteSelected} style={{
                        width: "100%", marginTop: 10, padding: "6px 0",
                        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
                        borderRadius: 6, color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: "600",
                      }}>🗑 Supprimer (Del)</button>
                    </div>

                    <div style={{ ...S.card, marginTop: 4 }}>
                      <div style={S.label}>Accrochages</div>
                      {[
                        { col: "#f87171", sym: "■", label: "Extrémité" },
                        { col: "#fbbf24", sym: "▲", label: "Milieu" },
                        { col: "#a78bfa", sym: "●", label: "Sur le mur" },
                        { col: "#34d399", sym: "—", label: "Ortho" },
                        { col: "#3a5070", sym: "+", label: "Grille" },
                      ].map(s => (
                        <div key={s.label} style={{ display: "flex", gap: 6, marginBottom: 3, color: "#2a3f58", fontSize: 11 }}>
                          <span style={{ color: s.col, fontSize: 9, minWidth: 10 }}>{s.sym}</span>
                          <span>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#1e3050", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                    Élément introuvable
                  </div>
                )}

                {!selected && (
                  <div style={{ ...S.card }}>
                    <div style={S.label}>Accrochages</div>
                    {[
                      { col: "#f87171", sym: "■", label: "Extrémité" },
                      { col: "#fbbf24", sym: "▲", label: "Milieu" },
                      { col: "#a78bfa", sym: "●", label: "Sur le mur" },
                      { col: "#34d399", sym: "—", label: "Ortho" },
                      { col: "#3a5070", sym: "+", label: "Grille" },
                    ].map(s => (
                      <div key={s.label} style={{ display: "flex", gap: 6, marginBottom: 3, color: "#2a3f58", fontSize: 11 }}>
                        <span style={{ color: s.col, fontSize: 9, minWidth: 10 }}>{s.sym}</span>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}