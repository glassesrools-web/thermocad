import React, { useMemo, useState } from "react";
import { LayoutGrid, Plus, Trash2, CopyCheck } from "lucide-react";
import Field from "./Field.jsx";
import Section from "./Section.jsx";
import { calculateRoomLosses } from "../../utils/dtrMath";
import { CLIMATE_ZONES, WILAYAS } from "../../data/algeria_climate.js";
import {
  WALL_R_PRESETS,
  ROOF_R_PRESETS,
  FLOOR_R_PRESETS,
  VITRAGE_OPTS,
  LAME_OPTS,
  CADRE_OPTS,
  MATERIAU_OPTS,
  ISOLANT_OPTS,
  gKV,
  gKP,
} from "../../data/dtrMaterials.js";

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const TABS = [
  { id: "vertical", label: "Vertical Elements (Murs & Baies)" },
  { id: "roof",     label: "Roofing (Toiture)" },
  { id: "floor",    label: "Flooring (Plancher Bas)" },
];

const VERTICAL_TYPES = ["Mur Extérieur", "Mur Intérieur (LNC)", "Fenêtre", "Porte", "Porte-Fenêtre"];
const ROOF_TYPES     = ["Toiture Terrasse", "Toiture Tuiles", "Plafond sous LNC"];
const FLOOR_TYPES    = ["Sur Terre-Plein", "Sur Vide Sanitaire", "Sur Sous-Sol", "Étage Intermédiaire"];
const CONTACT_OPTIONS = [
  { value: "EXT", label: "Extérieur" },
  { value: "LNC", label: "Local Non Chauffé (LNC)" },
];
const ORIENTATIONS = ["N", "S", "E", "W", "NE", "SE", "SW", "NW"];

// DTR 5.2.1 / 5.3 — floor-insulation types
const ISO_TYPES = [
  { val: "sans_iso",        label: "Sans isolation" },
  { val: "iso_perimetre",   label: "Isol. périphérique horiz." },
  { val: "iso_surface",     label: "Isol. totale (surface)" },
  { val: "iso_peri_mur",    label: "Isol. péri. + mur enterré" },
  { val: "iso_surface_mur", label: "Isol. totale + mur enterré" },
  { val: "mur_enterre",     label: "Mur enterré (Table 5.8)" },
];

const PSI_PRESETS = [
  { val: "",     label: "Presets DTR..." },
  { val: "0.45", label: "Plancher Bas (0.45)" },
  { val: "0.50", label: "Plancher Haut (0.50)" },
  { val: "0.20", label: "Mur/Mur (0.20)" },
  { val: "0.60", label: "Plancher Interm. (0.60)" },
];

// ── DTR C3.2 base temperatures by zone (fallback — until CLIMATE_ZONES carries them) ──
const ZONE_BASE_TEMP = { A: 4, B: 2, C: -2, D: 5, E: 6, E1: 6 };

// ── Default material vals matching the new WALL_R_PRESETS / ROOF_R_PRESETS / FLOOR_R_PRESETS ──
// Indices into each array (item 0 is "Manuel")
const DEFAULT_WALL_PRESET_IDX        = 14;  // "Double paroi brique 10+10 (lame d'air 4cm)" R=0.48
const DEFAULT_WALL_R                 = 0.48;
const DEFAULT_ROOF_PRESET_IDX_TERRASSE = 13; // "Toiture terrasse non isolée"  R=0.15  (fallback)
const DEFAULT_ROOF_R_TERRASSE          = 0.15;
const DEFAULT_ROOF_PRESET_IDX_TUILES   = 16; // "Comble non isolé"              R=0.10  (fallback)
const DEFAULT_ROOF_R_TUILES            = 0.10;
const DEFAULT_ROOF_PRESET_IDX_DALLE    = 1;  // "Dalle béton 15cm"              R=0.06
const DEFAULT_ROOF_R_DALLE             = 0.06;
const DEFAULT_FLOOR_PRESET_IDX       = 4;   // "Dalle + polystyrène 4cm + chape" R=1.08
const DEFAULT_FLOOR_R                = 1.08;

const DEFAULT_WIN_TYPE  = "double";
const DEFAULT_WIN_LAME  = "10_11";
const DEFAULT_WIN_CADRE = "bois_pvc";

const DEFAULT_DOOR_MAT  = "bois_3_2cm"; // U = 3.36

// ── Safe U-value helpers that never return an empty string ───────────────────
const safeKV = (type, lame, cadre) => {
  const u = gKV(type, lame, cadre);
  return typeof u === "number" && Number.isFinite(u) ? u : null;
};
const safeKP = (mat, contact) => {
  const u = gKP(mat, contact);
  return typeof u === "number" && Number.isFinite(u) ? u : null;
};

// ── Atomic update builder when element type changes ──────────────────────────
function buildUpdatesForElementType(prev, newElementType, group) {
  const updates = { elementType: newElementType };
  const contact = String(prev.contact ?? "EXT").toUpperCase();

  if (group === "vertical") {
    const isWin  = newElementType.includes("Fenêtre") || newElementType.includes("Baie");
    const isDoor = newElementType.startsWith("Porte") && !newElementType.includes("Fenêtre");

    if (isWin) {
      const winType  = prev.winType  || DEFAULT_WIN_TYPE;
      const winLame  = prev.winLame  || DEFAULT_WIN_LAME;
      const winCadre = prev.winCadre || DEFAULT_WIN_CADRE;
      Object.assign(updates, { winType, winLame, winCadre });
      if (winType !== "manuel") {
        const u = safeKV(winType, winLame, winCadre);
        if (u !== null) updates.uValue = u;
      }
      return updates;
    }

    if (isDoor) {
      const doorMat = prev.doorMat || DEFAULT_DOOR_MAT;
      Object.assign(updates, { doorMat });
      if (doorMat !== "manuel") {
        const u = safeKP(doorMat, contact === "LNC" ? "lnc" : "exterieur");
        if (u !== null) updates.uValue = u;
      }
      return updates;
    }

    // Opaque wall — store R-based preset
    return { ...updates, composition: DEFAULT_WALL_PRESET_IDX, rValue: DEFAULT_WALL_R };
  }

  if (group === "roof") {
    if (newElementType.includes("Tuiles"))
      return { ...updates, composition: DEFAULT_ROOF_PRESET_IDX_TUILES,   rValue: DEFAULT_ROOF_R_TUILES };
    if (newElementType.includes("Terrasse"))
      return { ...updates, composition: DEFAULT_ROOF_PRESET_IDX_TERRASSE, rValue: DEFAULT_ROOF_R_TERRASSE };
    return { ...updates, composition: DEFAULT_ROOF_PRESET_IDX_DALLE, rValue: DEFAULT_ROOF_R_DALLE };
  }

  if (group === "floor" && contact !== "SOL") {
    return { ...updates, composition: DEFAULT_FLOOR_PRESET_IDX, rValue: DEFAULT_FLOOR_R };
  }

  return updates;
}

function calcArea(surf) {
  const w = Number(surf.width);
  const h = Number(surf.height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return w * h;
  const a = Number(surf.area);
  return Number.isFinite(a) && a > 0 ? a : 0;
}

export default function RoomEditor({
  room,
  localName,
  project,
  onRoomChange,
  onAddSurface,
  onUpdateSurface,
  onRemoveSurface,
  onImportSurfaces,
  onApplyToAll,
}) {
  const [activeTab, setActiveTab] = useState("vertical");

  const surfaces = room?.surfaces ?? [];
  const filtered = useMemo(
    () => surfaces.filter((s) => (s.group ?? "vertical") === activeTab),
    [surfaces, activeTab]
  );

  const lossMetrics = useMemo(() => {
    if (!room) return { Qt: 0, Qt_ponts: 0, Qv: 0, Cin: 1.2, Q_total: 0 };
    return calculateRoomLosses(project, room);
  }, [project, room]);

  if (!room) return null;

  // Climate resolution — commune-selected zone first, then wilaya default.
  const wilayaId = project.info?.wilayaId ?? 16;
  const wilaya   = WILAYAS.find((w) => w.id === wilayaId) ?? WILAYAS[0];
  const zoneKey  = project.info?.climateZone ?? wilaya?.defaultZone ?? "A";
  const zone     = CLIMATE_ZONES[zoneKey] ?? CLIMATE_ZONES.A;
  const T_outdoor = zone?.baseTemp ?? ZONE_BASE_TEMP[zoneKey] ?? 0;
  const T_indoor  = Number(project.info?.indoorSetpoint ?? 20);
  const T_ground  = Number(project.info?.groundTemp ?? 10);

  const { Qt, Qt_ponts, Qv, Cin, Q_total } = lossMetrics;

  // ── Preset handlers (defined once, outside the .map()) ─────────────────────
  const handlePresetChange = (id, value, presets) => {
    // value is either "manuel" or a stringified array index
    if (value === "manuel") {
      onUpdateSurface(id, { composition: "manuel" });
      return;
    }
    const idx = parseInt(value, 10);
    const preset = presets[idx];
    const updates = { composition: idx };
    if (preset && preset.R !== null) updates.rValue = preset.R;
    onUpdateSurface(id, updates);
  };

  const handleWinChange = (id, s, field, value) => {
    const updates = { [field]: value };
    const type  = field === "winType"  ? value : (s.winType  || DEFAULT_WIN_TYPE);
    const lame  = field === "winLame"  ? value : (s.winLame  || DEFAULT_WIN_LAME);
    const cadre = field === "winCadre" ? value : (s.winCadre || DEFAULT_WIN_CADRE);
    if (type === "manuel") {
      // Clear any auto-computed value so the manual input starts empty and editable
      updates.uValue = "";
    } else if (cadre !== "manuel" && lame !== "manuel") {
      const u = safeKV(type, lame, cadre);
      if (u !== null) updates.uValue = u;
    }
    onUpdateSurface(id, updates);
  };

  const handleDoorChange = (id, s, field, value) => {
    const updates = { [field]: value };
    const mat     = field === "doorMat" ? value : (s.doorMat || DEFAULT_DOOR_MAT);
    const contact = String(s.contact ?? "EXT").toUpperCase() === "LNC" ? "lnc" : "exterieur";
    if (mat === "manuel") {
      // Clear any auto-computed value so the manual input starts empty and editable
      updates.uValue = "";
    } else {
      const u = safeKP(mat, contact);
      if (u !== null) updates.uValue = u;
    }
    onUpdateSurface(id, updates);
  };

  return (
    <div className="space-y-6">
      {/* ── Room identity ─────────────────────────────────────────────── */}
      <Section icon={LayoutGrid} title={`Room: ${room.name} (${localName})`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Room Name</label>
            <input
              type="text"
              value={room.name ?? ""}
              onChange={(e) => onRoomChange({ ...room, name: e.target.value })}
              className="glass-input w-full rounded-md px-3 py-2 mt-1 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Volume"           value={room.volume       ?? 0}   onChange={(v) => onRoomChange({ ...room, volume: v })}       unit="m³"  />
            <Field label="Infiltration (N)" value={room.infiltration ?? 0.5} onChange={(v) => onRoomChange({ ...room, infiltration: v })} unit="ACH" />
          </div>
        </div>
      </Section>

      {/* ── Surface table ─────────────────────────────────────────────── */}
      <Section icon={LayoutGrid} title="Room Details (DTR Surfaces)">
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id ? "glass-button-active" : "glass-button opacity-75 hover:opacity-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((surf) => {
            const area         = calcArea(surf);
            const isVertical   = (surf.group ?? "vertical") === "vertical";
            const isRoof       = surf.group === "roof";
            const isFloor      = surf.group === "floor";
            const contactValue = (surf.contact ?? "EXT").toUpperCase();
            const needsLncTemp = contactValue === "LNC";

            // Element-type classification
            const typeName = surf.elementType ?? "";
            const isWindow = typeName.includes("Fenêtre") || typeName.includes("Baie");
            const isDoor   = typeName.startsWith("Porte") && !typeName.includes("Fenêtre");
            const isWall   = !isWindow && !isDoor;

            // Opaque-surface preset list + resolved select value
            // composition is stored as an integer index (or "manuel")
            const opaquePresets = isRoof ? ROOF_R_PRESETS : isFloor ? FLOOR_R_PRESETS : WALL_R_PRESETS;
            const opaqueMatSelectValue =
              surf.composition === "manuel"
                ? "manuel"
                : (typeof surf.composition === "number" && opaquePresets[surf.composition] != null)
                  ? String(surf.composition)
                  : "manuel";

            // Auto-computed K values (null when "manuel" selected or invalid)
            const autoKV =
              isWindow && surf.winType !== "manuel"
                ? safeKV(surf.winType || DEFAULT_WIN_TYPE, surf.winLame || DEFAULT_WIN_LAME, surf.winCadre || DEFAULT_WIN_CADRE)
                : null;
            const doorContact = contactValue === "LNC" ? "lnc" : "exterieur";
            const autoKP =
              isDoor && surf.doorMat !== "manuel"
                ? safeKP(surf.doorMat || DEFAULT_DOOR_MAT, doorContact)
                : null;

            // Only show lame for double glazing — simple glazing has no air-gap
            const showLame = isWindow && (surf.winType === "double" || (!surf.winType));

            return (
              <div
                key={surf.id}
                className="p-4 rounded-xl border space-y-3 shadow-sm transition"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", borderWidth: "1px" }}
              >
                {/* ── Row 1 : type + contact + smart selector ─────────── */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">

                  {/* Element Type */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Element Type</label>
                    <select
                      value={surf.elementType ?? ""}
                      onChange={(e) =>
                        onUpdateSurface(surf.id, buildUpdatesForElementType(surf, e.target.value, surf.group ?? "vertical"))
                      }
                      className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                    >
                      {(isVertical ? VERTICAL_TYPES : isRoof ? ROOF_TYPES : FLOOR_TYPES).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vertical: Contact + Orientation */}
                  {isVertical && (
                    <>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Contact</label>
                        <select
                          value={contactValue}
                          onChange={(e) => {
                            const newC = e.target.value;
                            const updates = { contact: newC };
                            // Re-compute door K when contact changes
                            if (isDoor && surf.doorMat !== "manuel") {
                              const u = safeKP(surf.doorMat || DEFAULT_DOOR_MAT, newC === "LNC" ? "lnc" : "exterieur");
                              if (u !== null) updates.uValue = u;
                            }
                            onUpdateSurface(surf.id, updates);
                          }}
                          className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                        >
                          {CONTACT_OPTIONS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Orientation</label>
                        <select
                          value={surf.orientation ?? "N"}
                          onChange={(e) => onUpdateSurface(surf.id, { orientation: e.target.value })}
                          className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                        >
                          {ORIENTATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Roof: Contact */}
                  {isRoof && (
                    <div>
                      <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Contact</label>
                      <select
                        value={contactValue === "LNC" ? "LNC" : "EXT"}
                        onChange={(e) => onUpdateSurface(surf.id, { contact: e.target.value })}
                        className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                      >
                        <option value="EXT">Extérieur</option>
                        <option value="LNC">Combles Non Aménagés</option>
                      </select>
                    </div>
                  )}

                  {/* Floor: SOL params or reference label */}
                  {isFloor && (
                    <>
                      {contactValue === "SOL" ? (
                        <>
                          <div>
                            <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Périmètre (m)</label>
                            <input type="number" step="0.1" value={surf.perimetre ?? ""} onChange={(e) => onUpdateSurface(surf.id, { perimetre: Number(e.target.value) })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Prof. Z (m)</label>
                            <input type="number" step="0.1" value={surf.z ?? ""} onChange={(e) => onUpdateSurface(surf.id, { z: Number(e.target.value) })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm" placeholder="-0.5" />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Type Isol. Sol</label>
                            <select value={surf.type_iso ?? "sans_iso"} onChange={(e) => onUpdateSurface(surf.id, { type_iso: e.target.value })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm">
                              {ISO_TYPES.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
                            </select>
                          </div>
                          {surf.type_iso && surf.type_iso !== "sans_iso" && surf.type_iso !== "mur_enterre" && (
                            <div>
                              <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>R Isolant</label>
                              <input type="number" step="0.1" value={surf.r_iso ?? ""} onChange={(e) => onUpdateSurface(surf.id, { r_iso: Number(e.target.value) })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Reference</label>
                          <div className="glass-input rounded-md px-2 py-1.5 text-sm opacity-80 cursor-not-allowed">Adjacent / Interior</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* LNC temperature input */}
                  {needsLncTemp && (
                    <div>
                      <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Temp. LNC (°C)</label>
                      <input
                        type="number" step="0.5"
                        value={surf.lncTemp ?? ""}
                        onChange={(e) => onUpdateSurface(surf.id, { lncTemp: Number(e.target.value) })}
                        className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                      />
                    </div>
                  )}

                  {/* ── SMART SELECTOR: Opaque surfaces (Murs / Toiture / Plancher non-SOL) ── */}
                  {(isWall || isRoof || (isFloor && contactValue !== "SOL")) && (
                    <div className="md:col-span-2 space-y-2">
                      <label
                        className="text-xs font-medium flex items-center justify-between"
                        style={{ color: "var(--glass-text)", opacity: 0.8 }}
                      >
                        Matériau (DTR C3.2)
                        <span className="text-[9px] text-[var(--glass-primary)] opacity-70">U automatique</span>
                      </label>
                      <select
                        value={opaqueMatSelectValue}
                        onChange={(e) => handlePresetChange(surf.id, e.target.value, opaquePresets)}
                        className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                      >
                        {opaquePresets.map((p, i) => (
                          <option key={i} value={p.R === null ? "manuel" : String(i)} style={{ background: "var(--app-bg-color)" }}>
                            {p.label_fr}
                          </option>
                        ))}
                      </select>
                      {/* Base R badge — replaces the old U badge */}
                      {opaqueMatSelectValue !== "manuel" && Number(surf.rValue) > 0 && (
                        <p className="text-[11px] font-mono opacity-90" style={{ color: "var(--glass-primary)" }}>
                          R = {Number(surf.rValue).toFixed(2)} m²K/W
                        </p>
                      )}
                      {/* Manual R input */}
                      {opaqueMatSelectValue === "manuel" && (
                        <div>
                          <label className="text-xs font-medium opacity-80">Résistance R (saisie manuelle, m²K/W)</label>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="number" step="0.01"
                              value={surf.rValue ?? ""}
                              onChange={(e) => onUpdateSurface(surf.id, { rValue: Number(e.target.value) })}
                              className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                            />
                            <button
                              title="Appliquer à tous"
                              onClick={() => onApplyToAll(surf.elementType, {
                                composition: surf.composition,
                                rValue: surf.rValue,
                                isolantMat: surf.isolantMat,
                                isolantEpaisseur: surf.isolantEpaisseur,
                              })}
                              className="shrink-0 rounded-md p-1.5 text-xs opacity-60 hover:opacity-100 hover:bg-white/10 transition"
                            >
                              <CopyCheck size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                      {/* ── Insulation controls ── */}
                      <div
                        className="mt-1 p-2 rounded-lg space-y-1"
                        style={{ background: "var(--glass-accent-bg)", border: "1px solid var(--glass-border)" }}
                      >
                        <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--glass-text)", opacity: 0.7 }}>
                          Isolant thermique
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            className="glass-input text-[11px] px-1.5 py-1 rounded flex-1 min-w-[120px]"
                            value={surf.isolantMat || "aucun"}
                            onChange={(e) => onUpdateSurface(surf.id, { isolantMat: e.target.value })}
                          >
                            {ISOLANT_OPTS.map((opt) => (
                              <option key={opt.val} value={opt.val} style={{ background: "var(--app-bg-color)" }}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {surf.isolantMat && surf.isolantMat !== "aucun" && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="glass-input w-16 text-[11px] px-1.5 py-1 rounded"
                                value={surf.isolantEpaisseur ?? 0.05}
                                onChange={(e) =>
                                  onUpdateSurface(surf.id, { isolantEpaisseur: e.target.value })
                                }
                                title="Épaisseur en mètres (ex: 0.05 pour 5cm)"
                              />
                              <span className="text-[10px]" style={{ color: "var(--glass-text)", opacity: 0.6 }}>m</span>
                            </div>
                          )}
                        </div>
                        {/* Effective U after insulation */}
                        {surf.isolantMat && surf.isolantMat !== "aucun" && Number(surf.uValue) > 0 && (() => {
                          const isolant = ISOLANT_OPTS.find((o) => o.val === surf.isolantMat);
                          if (!isolant?.lambda) return null;
                          const ep = Number(surf.isolantEpaisseur) || 0.05;
                          const uEff = 1 / (1 / Number(surf.uValue) + ep / isolant.lambda);
                          return (
                            <p className="text-[11px] font-mono font-semibold" style={{ color: "var(--glass-primary)" }}>
                              U effectif = {uEff.toFixed(3)} W/m²K
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* ── SMART SELECTOR: Windows ── */}
                  {isWindow && (
                    <>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Vitrage</label>
                        <select
                          value={surf.winType || DEFAULT_WIN_TYPE}
                          onChange={(e) => handleWinChange(surf.id, surf, "winType", e.target.value)}
                          className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                        >
                          {VITRAGE_OPTS.map((o) => (
                            <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Lame d'air — only relevant for double glazing */}
                      {showLame && surf.winType !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Lame d&apos;air</label>
                          <select
                            value={surf.winLame || DEFAULT_WIN_LAME}
                            onChange={(e) => handleWinChange(surf.id, surf, "winLame", e.target.value)}
                            className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                          >
                            {LAME_OPTS.map((o) => (
                              <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {surf.winType !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Cadre</label>
                          <select
                            value={surf.winCadre || DEFAULT_WIN_CADRE}
                            onChange={(e) => handleWinChange(surf.id, surf, "winCadre", e.target.value)}
                            className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                          >
                            {CADRE_OPTS.map((o) => (
                              <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Auto K badge */}
                      {surf.winType !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>K DTR (W/m²K)</label>
                          <div
                            className="mt-1 rounded-md px-2 py-1.5 text-sm font-mono font-bold border"
                            style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
                          >
                            {autoKV !== null ? autoKV.toFixed(2) : "—"} W/m²K
                          </div>
                        </div>
                      )}

                      {/* Manual K input */}
                      {surf.winType === "manuel" && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium opacity-80">Coefficient K (saisie manuelle, W/m²K)</label>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="number" step="0.01" min="0"
                              value={surf.uValue ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                onUpdateSurface(surf.id, { uValue: raw });
                              }}
                              className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                            />
                            <button
                              title="Appliquer à tous"
                              onClick={() => onApplyToAll(surf.elementType, {
                                uValue: surf.uValue,
                                winType: surf.winType,
                                winLame: surf.winLame,
                                winCadre: surf.winCadre,
                              })}
                              className="shrink-0 rounded-md p-1.5 text-xs opacity-60 hover:opacity-100 hover:bg-white/10 transition"
                            >
                              <CopyCheck size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── SMART SELECTOR: Doors ── */}
                  {isDoor && (
                    <>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Matériau / Type</label>
                        <select
                          value={surf.doorMat || DEFAULT_DOOR_MAT}
                          onChange={(e) => handleDoorChange(surf.id, surf, "doorMat", e.target.value)}
                          className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                        >
                          {MATERIAU_OPTS.map((o) => (
                            <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Auto K badge — contact derived from surf.contact */}
                      {surf.doorMat !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>
                            K DTR (W/m²K)
                            <span className="ml-1 text-[9px] opacity-60">[{contactValue}]</span>
                          </label>
                          <div
                            className="mt-1 rounded-md px-2 py-1.5 text-sm font-mono font-bold border"
                            style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
                          >
                            {autoKP !== null ? autoKP.toFixed(2) : "—"} W/m²K
                          </div>
                        </div>
                      )}

                      {/* Manual K input */}
                      {surf.doorMat === "manuel" && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium opacity-80">Coefficient K (saisie manuelle, W/m²K)</label>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="number" step="0.01" min="0"
                              value={surf.uValue ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                onUpdateSurface(surf.id, { uValue: raw });
                              }}
                              className="glass-input w-full rounded-md px-2 py-1.5 text-sm"
                            />
                            <button
                              title="Appliquer à tous"
                              onClick={() => onApplyToAll(surf.elementType, {
                                uValue: surf.uValue,
                                doorMat: surf.doorMat,
                              })}
                              className="shrink-0 rounded-md p-1.5 text-xs opacity-60 hover:opacity-100 hover:bg-white/10 transition"
                            >
                              <CopyCheck size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>{/* end Row 1 */}

                {/* ── Row 2 : dimensions + thermal bridge + delete ──────── */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  {isVertical ? (
                    <>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Width (m)</label>
                        <input type="number" step="0.01" value={surf.width ?? ""} onChange={(e) => onUpdateSurface(surf.id, { width: Number(e.target.value) })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Height (m)</label>
                        <input type="number" step="0.01" value={surf.height ?? ""} onChange={(e) => onUpdateSurface(surf.id, { height: Number(e.target.value) })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm" />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2" />
                  )}

                  <div>
                    <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Manual Area (m²)</label>
                    <input type="number" step="0.01" value={surf.area ?? ""} onChange={(e) => onUpdateSurface(surf.id, { area: Number(e.target.value) })} className="glass-input w-full rounded-md px-2 py-1.5 text-sm" />
                  </div>

                  <div>
                    <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Effective Area</label>
                    <div
                      className="rounded-md border px-2 py-1.5 text-sm font-semibold font-mono shadow-inner"
                      style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success-text)" }}
                    >
                      {area.toFixed(2)} m²
                    </div>
                  </div>

                  {/* Thermal bridge */}
                  <div
                    className="md:col-span-2 grid grid-cols-2 gap-3 p-3 rounded-xl"
                    style={{ background: "var(--glass-accent-bg)", border: "1px solid var(--glass-border)" }}
                  >
                    <div>
                      <label className="text-xs font-medium flex justify-between items-center" style={{ color: "var(--glass-text)", opacity: 0.9 }}>
                        <span>Psi (W/mK)</span>
                      </label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number" step="0.01"
                          value={surf.psi ?? ""}
                          onChange={(e) => onUpdateSurface(surf.id, { psi: Number(e.target.value) })}
                          className="glass-input w-1/2 rounded-md px-2 py-1.5 text-sm"
                          placeholder="Ex: 0.45"
                        />
                        <select
                          onChange={(e) => { if (e.target.value !== "") onUpdateSurface(surf.id, { psi: Number(e.target.value) }); }}
                          className="glass-input w-1/2 rounded-md px-1 py-1.5 text-[10px] cursor-pointer"
                        >
                          {PSI_PRESETS.map((p) => (
                            <option key={p.val} value={p.val} style={{ background: "var(--app-bg-color)" }}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Longueur Pont (m)</label>
                      <input
                        type="number" step="0.01"
                        value={surf.bridgeLength ?? ""}
                        onChange={(e) => onUpdateSurface(surf.id, { bridgeLength: Number(e.target.value) })}
                        className="glass-input w-full rounded-md px-2 py-1.5 text-sm mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end ml-auto">
                    <button
                      onClick={() => onRemoveSurface(surf.id)}
                      className="p-2 rounded-md transition hover:bg-[var(--danger-bg)]"
                      style={{ color: "var(--danger-text)" }}
                      title="Remove element"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>{/* end Row 2 */}

              </div>
            );
          })}

          <button
            onClick={() => onAddSurface(activeTab)}
            className="glass-button flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus className="h-4 w-4" /> Add Element to {TABS.find((t) => t.id === activeTab)?.label}
          </button>
        </div>
      </Section>

      {/* ── Room results ──────────────────────────────────────────────── */}
      <Section icon={LayoutGrid} title="Room Results">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg border" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Transmission (W)</p>
            <p className="text-xl font-bold font-mono drop-shadow-md" style={{ color: "var(--danger-text)" }}>{Qt.toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-lg border" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Ventilation (W)</p>
            <p className="text-xl font-bold font-mono drop-shadow-md" style={{ color: "var(--glass-primary)" }}>{Qv.toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-lg border shadow-inner" style={{ background: "var(--glass-accent-bg)", borderColor: "var(--glass-primary)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--glass-primary)" }}>Total (W)</p>
            <p className="text-xl font-bold font-mono drop-shadow-md" style={{ color: "var(--glass-primary)" }}>{Q_total.toFixed(0)}</p>
          </div>
        </div>
        <p className="text-xs mt-2 font-mono" style={{ color: "var(--glass-text)", opacity: 0.8 }}>
          T_base: <span style={{ color: "var(--glass-primary)" }}>{T_outdoor}°C</span>
          {" · "}T_int: <span style={{ color: "var(--glass-primary)" }}>{T_indoor}°C</span>
          {" · "}T_sol: <span style={{ color: "var(--glass-primary)" }}>{T_ground}°C</span>
          {" · "}Ponts: <span style={{ color: "var(--danger-text)" }}>{Qt_ponts.toFixed(1)} W</span>
        </p>
      </Section>
    </div>
  );
}
