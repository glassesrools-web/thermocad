import React, { useState, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, Calculator, FileDown, Flame, Hexagon, Moon, PencilRuler, Snowflake, Sun } from "lucide-react";
import { calculateRoomLosses } from "../utils/dtrMath";
import { useReactToPrint } from "react-to-print";
import BilanChart from "../components/BilanChart.jsx";
import DPELabel from "../components/DPELabel.jsx";
import ReportTemplate from "../components/ReportTemplate.jsx";
import ThermoCAD from "../components/ThermoCAD.jsx";
import Sidebar, { PROJECT_SUMMARY_ID } from "./components/Sidebar.jsx";
import RoomEditor from "./components/RoomEditor.jsx";
import ProjectSummary from "./components/ProjectSummary.jsx";

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const BrandLogo = ({ size = "large" }) => {
  const isLarge = size === "large";
  return (
    <div className={`flex items-center ${isLarge ? "gap-4" : "gap-3"}`}>
      <div
        className={`relative rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-500 shadow-[0_0_40px_rgba(6,182,212,0.35)] ${
          isLarge ? "h-20 w-20" : "h-11 w-11"
        }`}
      >
        <div className="absolute inset-0 rounded-2xl blur-xl bg-cyan-500/40" />
        <div className="relative h-full w-full flex items-center justify-center">
          <Hexagon className={isLarge ? "h-10 w-10 text-white" : "h-5 w-5 text-white"} />
          <Flame className={`absolute text-white ${isLarge ? "h-5 w-5 -top-1 -left-1" : "h-3.5 w-3.5 -top-1 -left-1"}`} />
          <Snowflake className={`absolute text-white ${isLarge ? "h-5 w-5 -bottom-1 -right-1" : "h-3.5 w-3.5 -bottom-1 -right-1"}`} />
        </div>
      </div>
      <div>
        <h1 className={`${isLarge ? "text-5xl" : "text-xl"} font-black tracking-tight`}>
          ThermoCalc <span className="text-[var(--glass-primary)] drop-shadow-md">Pro</span>
        </h1>
        <p className={`${isLarge ? "text-base" : "text-xs"} opacity-60 font-medium`}>
          Advanced HVAC Load Engineering
        </p>
      </div>
    </div>
  );
};

const createLocal = () => ({ id: generateId(), name: "New Local", rooms: [] });
const createRoom = () => ({ id: generateId(), name: "New Room", volume: 50, infiltration: 0.5, surfaces: [{ id: generateId(), group: "vertical", elementType: "Mur Extérieur", contact: "EXT", orientation: "N", width: 4, height: 2.6, area: 10.4, composition: "brique_double", uValue: 1.28 }] });
const createSurface = (group = "vertical") => {
  // Defaults are seeded with DTR C3.2 preset values so the Smart Material
  // Selector in RoomEditor shows a consistent AUTO badge from the first render.
  if (group === "roof")  return { id: generateId(), group: "roof",  elementType: "Toiture Terrasse", contact: "EXT", area: 20, composition: "terrasse_iso", uValue: 0.48 };
  if (group === "floor") return { id: generateId(), group: "floor", elementType: "Sur Terre-Plein",  contact: "SOL", area: 20, uValue: 0.5 };
  return { id: generateId(), group: "vertical", elementType: "Mur Extérieur", contact: "EXT", orientation: "N", width: 3, height: 2.6, area: 7.8, composition: "brique_double", uValue: 1.28 };
};
const createProject = () => ({
  info: { name: "My Project", wilayaId: 16, indoorSetpoint: 20, groundTemp: 10, nb_pieces: 3, nb_sdb: 1, nb_autre_eau: 0, nb_wc: 1, type_chauf: "central_partiel", mode_chauf: "continu", inertie: "forte" },
  locals: [createLocal()],
});

function findRoom(project, localId, roomId) { const local = (project.locals ?? []).find((l) => l.id === localId); return local?.rooms?.find((r) => r.id === roomId) ?? null; }
function findLocal(project, localId) { return (project.locals ?? []).find((l) => l.id === localId) ?? null; }
function getSurfaceArea(surface) { const width = Number(surface.width ?? 0); const height = Number(surface.height ?? 0); if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return width * height; const area = Number(surface.area ?? 0); return Number.isFinite(area) && area > 0 ? area : 0; }

export default function App() {
  const [currentView, setCurrentView] = useState("menu");
  const [workspaceView, setWorkspaceView] = useState("calculator");
  const [project, setProject] = useState(createProject);
  const [activeId, setActiveId] = useState(PROJECT_SUMMARY_ID);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");
  const reportRef = useRef(null);

  React.useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const isProjectSummary = activeId === PROJECT_SUMMARY_ID;
  const isRoomActive = activeId?.type === "room";
  const isLocalActive = activeId?.type === "local";
  const activeRoom = isRoomActive ? findRoom(project, activeId.localId, activeId.roomId) : null;
  const activeLocal = isRoomActive ? findLocal(project, activeId.localId) : isLocalActive ? findLocal(project, activeId.id) : null;

  const updateProject = useCallback((updater) => setProject((p) => (typeof updater === "function" ? updater(p) : updater)), []);
  const addLocal = useCallback(() => { const newLocal = createLocal(); setProject((p) => ({ ...p, locals: [...(p.locals ?? []), newLocal] })); setActiveId(PROJECT_SUMMARY_ID); }, []);
  const addRoom = useCallback(() => { const locals = project.locals ?? []; if (locals.length === 0) { addLocal(); return; } const targetLocal = activeLocal ?? locals[0]; const newRoom = createRoom(); setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => l.id === targetLocal.id ? { ...l, rooms: [...(l.rooms ?? []), newRoom] } : l ) })); setActiveId({ type: "room", localId: targetLocal.id, roomId: newRoom.id }); }, [project.locals, activeLocal, addLocal]);
  const deleteLocal = useCallback((localId) => { const locals = project.locals ?? []; if (locals.length <= 1) return; const remaining = locals.filter((l) => l.id !== localId); setProject((p) => ({ ...p, locals: remaining })); if (activeId?.type === "local" && activeId?.id === localId) setActiveId(PROJECT_SUMMARY_ID); if (activeId?.type === "room" && activeId?.localId === localId) setActiveId(PROJECT_SUMMARY_ID); }, [project.locals, activeId]);
  const deleteRoom = useCallback((localId, roomId) => { setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => { if (l.id !== localId) return l; const rooms = (l.rooms ?? []).filter((r) => r.id !== roomId); return { ...l, rooms }; }) })); if (activeId?.type === "room" && activeId?.localId === localId && activeId?.roomId === roomId) setActiveId({ type: "local", id: localId }); }, [activeId]);
  const updateRoom = useCallback((localId, roomId, updates) => { setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => { if (l.id !== localId) return l; return { ...l, rooms: (l.rooms ?? []).map((r) => r.id === roomId ? { ...r, ...updates } : r ) }; }) })); }, []);
  const addSurface = useCallback((localId, roomId, group = "vertical") => { setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => { if (l.id !== localId) return l; return { ...l, rooms: (l.rooms ?? []).map((r) => r.id === roomId ? { ...r, surfaces: [...(r.surfaces ?? []), createSurface(group)] } : r ) }; }) })); }, []);
  const importSurfaces = useCallback((localId, roomId, surfaces) => { if (!Array.isArray(surfaces) || surfaces.length === 0) return; setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => { if (l.id !== localId) return l; return { ...l, rooms: (l.rooms ?? []).map((r) => r.id === roomId ? { ...r, surfaces: [...(r.surfaces ?? []), ...surfaces] } : r ) }; }) })); }, []);
  const updateSurface = useCallback((localId, roomId, surfaceId, updates) => { setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => { if (l.id !== localId) return l; return { ...l, rooms: (l.rooms ?? []).map((r) => { if (r.id !== roomId) return r; return { ...r, surfaces: (r.surfaces ?? []).map((s) => s.id === surfaceId ? { ...s, ...updates } : s ) }; }) }; }) })); }, []);
  const removeSurface = useCallback((localId, roomId, surfaceId) => { setProject((p) => ({ ...p, locals: (p.locals ?? []).map((l) => { if (l.id !== localId) return l; return { ...l, rooms: (l.rooms ?? []).map((r) => r.id === roomId ? { ...r, surfaces: (r.surfaces ?? []).filter((s) => s.id !== surfaceId) } : r ) }; }) })); }, []);
  const applySurfaceToAll = useCallback((elementType, updates) => {
    if (!window.confirm(`Voulez-vous vraiment appliquer ces propriétés à tous les éléments de type « ${elementType} » dans toutes les pièces du projet ?`)) return;
    const patch = { ...updates };
    setProject((p) => ({
      ...p,
      locals: (p.locals ?? []).map((l) => ({
        ...l,
        rooms: (l.rooms ?? []).map((r) => ({
          ...r,
          surfaces: (r.surfaces ?? []).map((s) =>
            s.elementType === elementType ? { ...s, ...patch } : { ...s }
          ),
        })),
      })),
    }));
  }, []);

  const handleExport = useCallback((cadSurfaces) => {
    if (!Array.isArray(cadSurfaces) || cadSurfaces.length === 0) return;

    const locals = project.locals ?? [];
    const fallbackLocal = locals[0] ?? null;
    const fallbackRoom  = fallbackLocal?.rooms?.[0] ?? null;

    if (!fallbackLocal) {
      setError("Aucun local disponible. Créez un local d'abord.");
      return;
    }

    // Build a case-insensitive name → {localId, roomId} lookup across all rooms
    const roomByName = new Map();
    for (const local of locals) {
      for (const room of local.rooms ?? []) {
        roomByName.set(room.name.trim().toLowerCase(), { localId: local.id, roomId: room.id });
      }
    }

    // Group incoming surfaces by their CAD roomId (canvas-local ID + roomName)
    const cadRoomGroups = new Map(); // cadRoomId → { cadRoomName, surfaces[] }
    const ungrouped = [];

    for (const s of cadSurfaces) {
      const normalized = { ...s, id: generateId(), group: s.group ?? "vertical", contact: s.contact ?? "EXT" };
      if (s.roomId) {
        if (!cadRoomGroups.has(s.roomId)) {
          cadRoomGroups.set(s.roomId, { cadRoomName: s.roomName ?? s.roomId, surfaces: [] });
        }
        cadRoomGroups.get(s.roomId).surfaces.push(normalized);
      } else {
        ungrouped.push(normalized);
      }
    }

    let lastLocalId = fallbackLocal.id;
    let lastRoomId  = null;

    setProject((p) => {
      let nextLocals = p.locals.map(l => ({ ...l, rooms: l.rooms.map(r => ({ ...r })) }));

      const appendTo = (localId, roomId, surfs) => {
        nextLocals = nextLocals.map(l => {
          if (l.id !== localId) return l;
          return { ...l, rooms: l.rooms.map(r => r.id !== roomId ? r : { ...r, surfaces: [...(r.surfaces ?? []), ...surfs] }) };
        });
      };

      for (const [, { cadRoomName, surfaces }] of cadRoomGroups) {
        const key = cadRoomName.trim().toLowerCase();
        const match = roomByName.get(key);

        if (match) {
          // Matched an existing App room by name — route surfaces there
          appendTo(match.localId, match.roomId, surfaces);
          lastLocalId = match.localId;
          lastRoomId  = match.roomId;
        } else {
          // No name match — create a new room in the first local
          const newRoomId = generateId();
          const newRoom = { id: newRoomId, name: cadRoomName, volume: 50, infiltration: 0.5, surfaces };
          nextLocals = nextLocals.map((l, idx) => idx !== 0 ? l : { ...l, rooms: [...(l.rooms ?? []), newRoom] });
          // Register so duplicate CAD room names don't create two App rooms
          roomByName.set(key, { localId: nextLocals[0].id, roomId: newRoomId });
          lastLocalId = nextLocals[0].id;
          lastRoomId  = newRoomId;
        }
      }

      // Surfaces with no roomId are grouped under a dedicated catch-all room
      if (ungrouped.length > 0) {
        const catchAllName = "Surfaces non assignées";
        const catchAllKey  = catchAllName.toLowerCase();
        const existing = roomByName.get(catchAllKey);
        if (existing) {
          appendTo(existing.localId, existing.roomId, ungrouped);
          lastLocalId = existing.localId;
          lastRoomId  = existing.roomId;
        } else {
          const newRoomId = generateId();
          const newRoom = { id: newRoomId, name: catchAllName, volume: 50, infiltration: 0.5, surfaces: ungrouped };
          nextLocals = nextLocals.map((l, idx) => idx !== 0 ? l : { ...l, rooms: [...(l.rooms ?? []), newRoom] });
          roomByName.set(catchAllKey, { localId: nextLocals[0].id, roomId: newRoomId });
          lastLocalId = nextLocals[0].id;
          lastRoomId  = newRoomId;
        }
      }

      // Navigate to the last touched room after state settles
      Promise.resolve().then(() => {
        if (lastRoomId) {
          setActiveId({ type: "room", localId: lastLocalId, roomId: lastRoomId });
        } else {
          setActiveId({ type: "local", id: lastLocalId });
        }
        setWorkspaceView("calculator");
        setError("");
      });

      return { ...p, locals: nextLocals };
    });
  }, [activeId, project.locals]);

  const calculate = useCallback(async () => {
    setError("");
    try {
      const roomResults = []; let H_transmission = 0; let H_vent = 0; let Dref_total = 0; let Q_design_W = 0; let DB_total = 0;
      for (const local of project.locals ?? []) {
        for (const room of local.rooms ?? []) {
          const losses = calculateRoomLosses(project, room);
          roomResults.push({ id: room.id, name: room.name, localId: local.id, localName: local.name, Q_transmission: losses.Qt, Q_ventilation: losses.Qv, Q_total: losses.Q_total, DB: losses.DB, Cin: losses.Cin, DT: losses.DT, DR: losses.DR, Dref: losses.Dref, reg_ok: losses.reg_ok });
          H_transmission += losses.DT; H_vent += losses.DR; Dref_total += losses.Dref; Q_design_W += losses.Q_total; DB_total += losses.DB ?? 0;
        }
      }
      const DT_limit = 1.05 * Dref_total;
      const reg_ok = Dref_total > 0 ? H_transmission <= DT_limit : null;
      setResults({ H_transmission, H_vent, H_total: H_transmission + H_vent, Dref: Dref_total, DT_limit, reg_ok, Q_design_W, Q_design_kW: Q_design_W / 1000, DB_total, Q_daily_kWh: 0, roomResults, hourlyLoads: [] });
      setActiveId(PROJECT_SUMMARY_ID);
    } catch (e) { setError(e.message); setResults(null); }
  }, [project]);

  const exportResults = useCallback((format, data) => {
    if (!data) return;
    let content = ""; let mime = ""; let filename = "";
    if (format === "csv") {
      const rows = [ ["Metric", "Value", "Unit"], ["Transmission Coeff", data.H_transmission.toFixed(2), "W/K"], ["Ventilation Coeff", data.H_vent.toFixed(2), "W/K"], ["Total Coeff", data.H_total.toFixed(2), "W/K"], ["Design Heat Load", data.Q_design_W.toFixed(2), "W"] ];
      rows.push(["---", "---", "---"]); rows.push(["Local", "Room", "Transmission (W)", "Ventilation (W)", "Total (W)"]);
      (data.roomResults || []).forEach((r) => rows.push([ r.localName ?? "", r.name, r.Q_transmission.toFixed(0), r.Q_ventilation.toFixed(0), r.Q_total.toFixed(0) ]));
      content = rows.map((r) => r.join(",")).join("\n"); mime = "text/csv"; filename = "thermocalc-results.csv";
    } else {
      content = JSON.stringify(data, null, 2); mime = "application/json"; filename = "thermocalc-results.json";
    }
    const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }, []);

  const hasRooms = (project.locals ?? []).some((l) => (l.rooms ?? []).length > 0);

  const reportRows = useMemo(() => {
    if (!results) return []; const rows = []; const roomResultMap = new Map((results.roomResults ?? []).map((r) => [r.id, r]));
    for (const local of project.locals ?? []) {
      for (const room of local.rooms ?? []) {
        const roomResult = roomResultMap.get(room.id); if (!roomResult) continue;
        const surfaces = room.surfaces ?? [];
        const weightedSum = surfaces.reduce((sum, s) => sum + Math.max(0, (Number(s.uValue ?? 0) * getSurfaceArea(s)) + (Number(s.psi ?? 0) * Number(s.bridgeLength ?? 0))), 0);
        for (const surface of surfaces) {
          const area = getSurfaceArea(surface); const ua = Number(surface.uValue ?? 0) * area; const bridge = Number(surface.psi ?? 0) * Number(surface.bridgeLength ?? 0);
          const weight = weightedSum > 0 ? (Math.max(0, ua + bridge) / weightedSum) : 0;
          rows.push({ localName: local.name, roomName: room.name, roomId: room.id, roomVolume: Number(room.volume ?? 0), surfaceId: surface.id, elementType: surface.elementType ?? "Paroi", group: surface.group ?? "vertical", area, uValue: Number(surface.uValue ?? 0), loss: roomResult.Q_transmission * weight });
        }
      }
    } return rows;
  }, [project.locals, results]);

  const bilanChartData = useMemo(() => {
    if (!results) return [];
    return [
      { name: "Walls", value: reportRows.filter((r) => r.group === "vertical" && /mur/i.test(r.elementType)).reduce((s, r) => s + r.loss, 0) },
      { name: "Windows/Doors", value: reportRows.filter((r) => r.group === "vertical" && /(fen|porte)/i.test(r.elementType)).reduce((s, r) => s + r.loss, 0) },
      { name: "Roof", value: reportRows.filter((r) => r.group === "roof").reduce((s, r) => s + r.loss, 0) },
      { name: "Floor", value: reportRows.filter((r) => r.group === "floor").reduce((s, r) => s + r.loss, 0) },
      { name: "Ventilation", value: (results.roomResults ?? []).reduce((s, r) => s + Number(r.Q_ventilation ?? 0), 0) },
    ];
  }, [reportRows, results]);

  const wattsPerCube = useMemo(() => {
    const totalVolume = (project.locals ?? []).reduce((sum, local) => sum + (local.rooms ?? []).reduce((rSum, r) => rSum + Number(r.volume ?? 0), 0), 0);
    return !results || totalVolume <= 0 ? 0 : Number(results.Q_design_W ?? 0) / totalVolume;
  }, [project.locals, results]);

  const handlePrintReport = useReactToPrint({ content: () => reportRef.current, documentTitle: `ThermoCalc_Rapport_${project.info?.name ?? "Projet"}` });

  if (currentView === "menu") {
    return (
      <div data-theme={theme} className="min-h-screen w-full relative transition-all duration-500 bg-transparent">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative min-h-screen flex flex-col">
          <button onClick={toggleTheme} className="glass-button absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <main className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-3xl glass-panel p-10 md:p-14 text-center">
              <div className="flex justify-center mb-10"><BrandLogo size="large" /></div>
              <div className="max-w-lg mx-auto space-y-4">
                <button onClick={() => setCurrentView("app")} className="glass-button-primary w-full py-4 font-bold text-lg">New Project</button>
                <button disabled className="glass-button w-full py-4 font-semibold text-lg cursor-not-allowed opacity-50">Load Project</button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="min-h-screen w-full relative transition-all duration-500 font-sans flex bg-transparent">
      <Sidebar project={project} onProjectChange={setProject} activeId={activeId} onActiveChange={setActiveId} onAddLocal={addLocal} onAddRoom={addRoom} onDeleteLocal={deleteLocal} onDeleteRoom={(localId, roomId) => deleteRoom(localId, roomId)} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="glass-panel border-b-0 rounded-none sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <button onClick={() => setCurrentView("menu")} className="glass-button inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm">
              <ArrowLeft className="h-4 w-4" /> Back to Menu
            </button>
            <BrandLogo size="small" />
            <button onClick={toggleTheme} className="glass-button flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden md:inline">{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>

        <div className={workspaceView === "thermocad"
          ? "flex-1 flex flex-col min-h-0 w-full"
          : "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col"
        }>
          <div
            className={`inline-flex glass-panel p-1 gap-1 ${workspaceView === "thermocad" ? "mb-0 mx-3 mt-2" : "mb-6"}`}
            style={{ borderRadius: 12 }}
          >
            <button onClick={() => setWorkspaceView("calculator")} className={`glass-button px-4 py-2 rounded-lg text-sm font-medium ${workspaceView === "calculator" ? "glass-button-active" : ""}`}>
              <span className="inline-flex items-center gap-2"><Calculator className="h-4 w-4" /> Calculateur</span>
            </button>
            <button onClick={() => setWorkspaceView("thermocad")} className={`glass-button px-4 py-2 rounded-lg text-sm font-medium ${workspaceView === "thermocad" ? "glass-button-active" : ""}`}>
              <span className="inline-flex items-center gap-2"><PencilRuler className="h-4 w-4" /> ThermoCAD</span>
            </button>
          </div>

          {/* ThermoCAD kept alive with CSS visibility so canvas state is preserved */}
          <div className={`flex-1 flex flex-col min-h-0 ${workspaceView === "thermocad" ? "flex" : "hidden"}`}>
            <ThermoCAD onExportSurfaces={handleExport} />
          </div>

          <div className={`flex-1 flex flex-col ${workspaceView === "calculator" ? "block" : "hidden"}`}>
            <div className="flex items-center gap-4 mb-6">
              <button onClick={calculate} className="glass-button-primary flex items-center gap-2 disabled:opacity-40 disabled:shadow-none" disabled={!hasRooms}>
                <Calculator className="h-5 w-5" /> Run Calculation
              </button>
              {error && <span className="text-[var(--danger-text)] font-medium p-2 bg-[var(--danger-bg)] rounded-lg border border-[var(--danger-border)]">{error}</span>}
            </div>

            {isProjectSummary && (
              <div>
                {results ? (
                  <div className="glass-panel p-1" style={{ borderRadius: 24 }}>
                    <div className="px-6 pt-5">
                      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                          <p className="text-[var(--glass-primary)] text-sm uppercase tracking-wide font-semibold mb-2">Puissance Chauffage (Q)</p>
                          <div className="inline-block min-w-[210px]">
                            <div className="flex items-baseline gap-3">
                              <p className="text-6xl font-sans font-black tracking-tighter drop-shadow-md text-[var(--glass-primary)] leading-none">{results.Q_design_kW.toFixed(2)}</p>
                              <p className="text-2xl font-bold text-[var(--glass-primary)] opacity-75">kW</p>
                            </div>
                            <p className="text-xs mt-1.5 text-[var(--glass-primary)] opacity-60">{results.Q_design_W.toFixed(0)} W · ΔT zone + Cin</p>
                          </div>
                        </div>

                        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${results.reg_ok === null ? "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--glass-text)]" : results.reg_ok ? "bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger-text)]"}`}>
                          {results.reg_ok === null ? <span className="h-5 w-5 rounded-full bg-black/10 text-xs font-bold flex items-center justify-center flex-shrink-0">?</span> : results.reg_ok ? <span className="sk-led flex-shrink-0" style={{ width: 18, height: 18 }} /> : <span className="sk-led-red flex-shrink-0" style={{ width: 18, height: 18 }} />}
                          <div>
                            <p className="text-[11px] uppercase tracking-wide font-bold opacity-80">Règlement DTR C3.2</p>
                            <p className="text-base font-extrabold">{results.reg_ok === null ? "Dref indisponible" : results.reg_ok ? "Conforme" : "Non conforme"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <BilanChart data={bilanChartData} />
                        <DPELabel wattsPerCube={wattsPerCube} />
                      </div>
                      <div className="mt-4 pb-4">
                        <button onClick={handlePrintReport} className="glass-button inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold"><FileDown className="h-5 w-5" /> Générer Rapport PDF</button>
                      </div>
                    </div>
                    <div className="mt-4 glass-panel border-0" style={{ borderRadius: 20 }}>
                      <ProjectSummary results={results} onExport={exportResults} />
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-8 text-center opacity-70" style={{ borderRadius: 16 }}>
                    <p>Click &quot;Run Calculation&quot; to compute the global heat load.</p>
                    <p className="text-sm mt-2 opacity-70">Select a room in the sidebar to edit its data.</p>
                  </div>
                )}
              </div>
            )}

            {isRoomActive && activeRoom && activeLocal && (
              <RoomEditor room={activeRoom} localName={activeLocal.name} project={project} onRoomChange={(updates) => updateRoom(activeId.localId, activeId.roomId, updates)} onAddSurface={(group) => addSurface(activeId.localId, activeId.roomId, group)} onUpdateSurface={(surfaceId, updates) => updateSurface(activeId.localId, activeId.roomId, surfaceId, updates)} onRemoveSurface={(surfaceId) => removeSurface(activeId.localId, activeId.roomId, surfaceId)} onImportSurfaces={(surfaces) => importSurfaces(activeId.localId, activeId.roomId, surfaces)} onApplyToAll={applySurfaceToAll} />
            )}

            {isLocalActive && activeLocal && (
              <div className="glass-panel p-8" style={{ borderRadius: 16 }}>
                <p>Local &quot;<span className="font-semibold text-[var(--glass-primary)]">{activeLocal.name}</span>&quot; has {(activeLocal.rooms ?? []).length} room(s).</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <div style={{ position: "fixed", top: "-9999px", left: "-9999px", width: "210mm", minHeight: "297mm", background: "#fff", zIndex: -1 }}><div ref={reportRef}><ReportTemplate project={project} results={results} chartData={bilanChartData} wattsPerCube={wattsPerCube} reportRows={reportRows} /></div></div>
    </div>
  );
}