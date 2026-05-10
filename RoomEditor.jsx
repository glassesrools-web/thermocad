import React, { useMemo, useState } from "react";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import Field from "./Field.jsx";
import Section from "./Section.jsx";
import { calculateRoomLosses, gKV, gKP } from "../../utils/dtrMath";
import { CLIMATE_ZONES, WILAYAS } from "../../data/algeria_climate.js";

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const TABS = [
  { id: "vertical", label: "Vertical Elements (Murs & Baies)" },
  { id: "roof", label: "Roofing (Toiture)" },
  { id: "floor", label: "Flooring (Plancher Bas)" },
];

const VERTICAL_TYPES = ["Mur Extérieur", "Mur Intérieur (LNC)", "Fenêtre", "Porte", "Porte-Fenêtre"];
const ROOF_TYPES = ["Toiture Terrasse", "Toiture Tuiles", "Plafond sous LNC"];
const FLOOR_TYPES = ["Sur Terre-Plein", "Sur Vide Sanitaire", "Sur Sous-Sol", "Étage Intermédiaire"];
const CONTACT_OPTIONS = [{ value: "EXT", label: "Extérieur" }, { value: "LNC", label: "Local Non Chauffé (LNC)" }];
const ORIENTATIONS = ["N", "S", "E", "W", "NE", "SE", "SW", "NW"];

// DTR 5.2.1 / 5.3 Types d'isolation au sol
const ISO_TYPES = [
  { val: "sans_iso",       label: "Sans isolation" },
  { val: "iso_perimetre",  label: "Isol. périphérique horiz." },
  { val: "iso_surface",    label: "Isol. totale (surface)" },
  { val: "iso_peri_mur",   label: "Isol. péri. + mur enterré" },
  { val: "iso_surface_mur",label: "Isol. totale + mur enterré" },
  { val: "mur_enterre",    label: "Mur enterré (Table 5.8)" },
];

const PSI_PRESETS = [
  { val: "",     label: "Presets DTR..." },
  { val: "0.45", label: "Plancher Bas (0.45)" },
  { val: "0.50", label: "Plancher Haut (0.50)" },
  { val: "0.20", label: "Mur/Mur (0.20)" },
  { val: "0.60", label: "Plancher Interm. (0.60)" },
];

// ── Smart Material Presets — DTR C3.2 Annexe A.2 + Exemples III.6/III.7 ──────
const PRESETS_MURS = [
  { val: "brique_double",     label: "Double paroi brique (10+air+10) [DTR]",    u: 1.28 },
  { val: "brique_double_iso", label: "Double brique + Isolant 5cm [Ex. III.6]",  u: 0.66 },
  { val: "brique_simple",     label: "Mur simple brique creuse (10cm)",           u: 2.38 },
  { val: "beton_20",          label: "Voile en Béton Armé (20cm) [DTR A.2]",     u: 3.57 },
  { val: "manuel",            label: "Personnalisé (Saisie Manuelle U)",          u: ""   },
];
const PRESETS_TOITURES = [
  { val: "terrasse_iso", label: "Toiture Terrasse Isolée (8cm) [Ex. III.7]",     u: 0.48 },
  { val: "dalle_pleine", label: "Dalle Pleine Béton (20cm) non isolée",           u: 3.57 },
  { val: "tuiles",       label: "Toiture en Tuiles [DTR]",                        u: 2.50 },
  { val: "manuel",       label: "Personnalisé (Saisie Manuelle U)",               u: ""   },
];
const PRESETS_PLANCHERS = [
  { val: "dalle_pleine", label: "Dalle Pleine (15cm)",                            u: 2.70 },
  { val: "manuel",       label: "Personnalisé (Saisie Manuelle U)",               u: ""   },
];

// ── Window / Door selector options ────────────────────────────────────────────
const VITRAGE_OPTIONS = [
  { val: "simple", label: "Vitrage Simple" },
  { val: "double", label: "Double Vitrage (lame d'air)" },
  { val: "dp30",   label: "Double Vitrage >30 mm" },
  { val: "manuel", label: "Manuel (saisie libre)" },
];
const LAME_OPTIONS = [
  { val: "5",  label: "5 mm" },
  { val: "8",  label: "8 mm" },
  { val: "10", label: "10 mm" },
  { val: "12", label: "12 mm" },
];
const CADRE_OPTIONS = [
  { val: "bois",  label: "Cadre Bois / PVC" },
  { val: "metal", label: "Cadre Métal" },
];
const MATERIAU_OPTIONS = [
  { val: "bois",   label: "Bois / Composite" },
  { val: "metal",  label: "Métal" },
  { val: "manuel", label: "Manuel (saisie libre)" },
];
const PROP_VITRAGE_OPTIONS = [
  { val: "opaque", label: "Opaque (sans vitrage)" },
  { val: "v30",    label: "Vitrée < 30 %" },
  { val: "v60",    label: "Vitrée 30–60 %" },
];

// ── Atomic update builder when element type changes ───────────────────────────
function buildUpdatesForElementType(prev, newElementType, group) {
  const updates = { elementType: newElementType };
  const contact = String(prev.contact ?? "EXT").toUpperCase();

  if (group === "vertical") {
    const isWin  = newElementType.includes("Fenêtre") || newElementType.includes("Baie");
    const isDoor = newElementType.startsWith("Porte") && !newElementType.includes("Fenêtre");

    if (isWin) {
      const winType  = prev.winType  || "double";
      const winLame  = prev.winLame  || "12";
      const winCadre = prev.winCadre || "bois";
      Object.assign(updates, { winType, winLame, winCadre });
      if (winType !== "manuel") {
        updates.uValue = gKV(winType, Number(winLame) || 12, winCadre === "metal" ? "metal" : "bois");
      }
      return updates;
    }

    if (isDoor) {
      const doorMat = prev.doorMat || "bois";
      const doorVit = prev.doorVit || "opaque";
      Object.assign(updates, { doorMat, doorVit });
      if (doorMat !== "manuel") updates.uValue = gKP(doorMat, doorVit, contact);
      return updates;
    }

    // Opaque wall
    return { ...updates, composition: "brique_double", uValue: 1.28 };
  }

  if (group === "roof") {
    if (newElementType.includes("Tuiles"))   return { ...updates, composition: "tuiles",       uValue: 2.5  };
    if (newElementType.includes("Terrasse")) return { ...updates, composition: "terrasse_iso",  uValue: 0.48 };
    return { ...updates, composition: "dalle_pleine", uValue: 3.57 };
  }

  if (group === "floor" && contact !== "SOL") {
    return { ...updates, composition: "dalle_pleine", uValue: 2.7 };
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

  const wilaya = WILAYAS.find((w) => w.id === (project.info?.wilayaId ?? 16)) ?? WILAYAS[0];
  const zone   = CLIMATE_ZONES[wilaya.zone] ?? CLIMATE_ZONES.A;
  const T_outdoor = zone.baseTemp;
  const T_indoor  = Number(project.info?.indoorSetpoint ?? 20);
  const T_ground  = Number(project.info?.groundTemp ?? 10);

  const { Qt, Qt_ponts, Qv, Cin, Q_total } = lossMetrics;

  // ── Preset handlers (defined once, outside the .map()) ───────────────────
  const handlePresetChange = (id, value, presets) => {
    const preset = presets.find((p) => p.val === value);
    const updates = { composition: value };
    if (preset && preset.u !== "") updates.uValue = preset.u;
    onUpdateSurface(id, updates);
  };

  const handleWinChange = (id, s, field, value) => {
    const updates = { [field]: value };
    const type  = field === "winType"  ? value : (s.winType  || "double");
    const lame  = field === "winLame"  ? value : (s.winLame  || "12");
    const cadre = field === "winCadre" ? value : (s.winCadre || "bois");
    if (type !== "manuel") {
      updates.uValue = gKV(type, Number(lame) || 12, cadre === "metal" ? "metal" : "bois");
    }
    onUpdateSurface(id, updates);
  };

  const handleDoorChange = (id, s, field, value) => {
    const updates = { [field]: value };
    const mat = field === "doorMat" ? value : (s.doorMat || "bois");
    const vit = field === "doorVit" ? value : (s.doorVit || "opaque");
    if (mat !== "manuel") updates.uValue = gKP(mat, vit, s.contact || "EXT");
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
            <Field label="Volume"           value={room.volume      ?? 0}   onChange={(v) => onRoomChange({ ...room, volume: v })}      unit="m³"  />
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
            const opaquePresets = isRoof ? PRESETS_TOITURES : isFloor ? PRESETS_PLANCHERS : PRESETS_MURS;
            const opaqueMatSelectValue =
              surf.composition === "manuel"
                ? "manuel"
                : opaquePresets.some((p) => p.val === surf.composition)
                  ? surf.composition
                  : "manuel";

            // Auto-computed K values (null when "manuel" selected)
            const autoKV =
              isWindow && surf.winType !== "manuel"
                ? gKV(surf.winType || "double", Number(surf.winLame || "12"), surf.winCadre || "bois")
                : null;
            const autoKP =
              isDoor && surf.doorMat !== "manuel"
                ? gKP(surf.doorMat || "bois", surf.doorVit || "opaque", contactValue)
                : null;

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
                              updates.uValue = gKP(surf.doorMat || "bois", surf.doorVit || "opaque", newC);
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
                        {opaquePresets.map((p) => (
                          <option key={p.val} value={p.val} style={{ background: "var(--app-bg-color)" }}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      {/* Auto U badge */}
                      {opaqueMatSelectValue !== "manuel" && Number(surf.uValue) > 0 && (
                        <p className="text-[11px] font-mono opacity-90" style={{ color: "var(--glass-primary)" }}>
                          U = {Number(surf.uValue).toFixed(2)} W/m²K
                        </p>
                      )}
                      {/* Manual U input */}
                      {opaqueMatSelectValue === "manuel" && (
                        <div>
                          <label className="text-xs font-medium opacity-80">Coefficient U (saisie manuelle)</label>
                          <input
                            type="number" step="0.01"
                            value={surf.uValue ?? ""}
                            onChange={(e) => onUpdateSurface(surf.id, { uValue: Number(e.target.value) })}
                            className="glass-input mt-1 w-full rounded-md px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── SMART SELECTOR: Windows ── */}
                  {isWindow && (
                    <>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Vitrage</label>
                        <select
                          value={surf.winType || "double"}
                          onChange={(e) => handleWinChange(surf.id, surf, "winType", e.target.value)}
                          className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                        >
                          {VITRAGE_OPTIONS.map((o) => (
                            <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Lame d'air only for double glazing */}
                      {(surf.winType === "double" || !surf.winType) && surf.winType !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Lame d&apos;air</label>
                          <select
                            value={surf.winLame || "12"}
                            onChange={(e) => handleWinChange(surf.id, surf, "winLame", e.target.value)}
                            className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                          >
                            {LAME_OPTIONS.map((o) => (
                              <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {surf.winType !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Cadre</label>
                          <select
                            value={surf.winCadre || "bois"}
                            onChange={(e) => handleWinChange(surf.id, surf, "winCadre", e.target.value)}
                            className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                          >
                            {CADRE_OPTIONS.map((o) => (
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
                            {autoKV !== null ? autoKV : "—"} W/m²K
                          </div>
                        </div>
                      )}

                      {/* Manual K input */}
                      {surf.winType === "manuel" && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium opacity-80">Coefficient K (saisie manuelle, W/m²K)</label>
                          <input
                            type="number" step="0.01"
                            value={surf.uValue ?? ""}
                            onChange={(e) => onUpdateSurface(surf.id, { uValue: Number(e.target.value) })}
                            className="glass-input mt-1 w-full rounded-md px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* ── SMART SELECTOR: Doors ── */}
                  {isDoor && (
                    <>
                      <div>
                        <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Matériau</label>
                        <select
                          value={surf.doorMat || "bois"}
                          onChange={(e) => handleDoorChange(surf.id, surf, "doorMat", e.target.value)}
                          className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                        >
                          {MATERIAU_OPTIONS.map((o) => (
                            <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {surf.doorMat !== "manuel" && (
                        <div>
                          <label className="text-xs font-medium" style={{ color: "var(--glass-text)", opacity: 0.8 }}>Proportion Vitrage</label>
                          <select
                            value={surf.doorVit || "opaque"}
                            onChange={(e) => handleDoorChange(surf.id, surf, "doorVit", e.target.value)}
                            className="glass-input w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                          >
                            {PROP_VITRAGE_OPTIONS.map((o) => (
                              <option key={o.val} value={o.val} style={{ background: "var(--app-bg-color)" }}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Auto K badge */}
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
                            {autoKP !== null ? autoKP : "—"} W/m²K
                          </div>
                        </div>
                      )}

                      {/* Manual K input */}
                      {surf.doorMat === "manuel" && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium opacity-80">Coefficient K (saisie manuelle, W/m²K)</label>
                          <input
                            type="number" step="0.01"
                            value={surf.uValue ?? ""}
                            onChange={(e) => onUpdateSurface(surf.id, { uValue: Number(e.target.value) })}
                            className="glass-input mt-1 w-full rounded-md px-2 py-1.5 text-sm"
                          />
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
