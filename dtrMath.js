/**
 * dtrMath.js — DTR C3.2 Heat-Loss Calculation Engine
 *
 * Exports:
 *   calculateUWithInsulation(baseR, isolantMat, epaisseur) → effective U [W/m²K]
 *   calculateRoomLosses(project, room)                    → loss metrics object
 *
 * Surface shape expected per element:
 *   Opaque (wall / roof / floor):
 *     rValue        {number}  – construction-layer R [m²K/W] (from preset or manual)
 *     uValue        {number}  – legacy U [W/m²K] (fallback when rValue absent)
 *     isolantMat    {string}  – key into ISOLANT_OPTS (or "aucun" / undefined)
 *     isolantEpaisseur {number} – insulation thickness [m]
 *     contact       {string}  – "EXT" | "LNC" | "SOL"
 *     group         {string}  – "vertical" | "roof" | "floor"
 *     psi           {number}  – linear TB coefficient [W/mK]  (optional)
 *     bridgeLength  {number}  – TB linear length [m]           (optional)
 *     lncTemp       {number}  – LNC space temperature [°C]     (optional)
 *
 *   Window / Door (glazing & portal):
 *     uValue        {number}  – U or K [W/m²K]  (direct — no Rs adjustment)
 *     psi / bridgeLength as above
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DTR C3.2 Surface Resistances  (Table 2, §3.2)
 *   Vertical elements (walls, windows, doors):   Rs_int = 0.13,  Rs_ext = 0.04
 *   Horizontal — upward heat flow (roofs):        Rs_int = 0.10,  Rs_ext = 0.04
 *   Horizontal — downward heat flow (floors):     Rs_int = 0.17,  Rs_ext = 0.04
 *   LNC contact (both sides interior-like):       Rs_int = 0.13,  Rs_lnc = 0.13
 */

import { ISOLANT_OPTS } from "./dtrMaterials.js";
import { WILAYAS, CLIMATE_ZONES } from "./algeria_climate.js";

// ─── DTR C3.2 Surface Resistances (m²K/W) ────────────────────────────────────
const RS = {
  wall:  { int: 0.13, ext: 0.04 },
  roof:  { int: 0.10, ext: 0.04 },
  floor: { int: 0.17, ext: 0.04 },
  lnc:   { int: 0.13, lnc: 0.13 }, // both sides treated as interior-adjacent
};

// ─── DTR C3.2 §3 — Base outdoor design temperatures by zone ─────────────────
const ZONE_BASE_TEMP = { A: 4, B: 2, C: -2, D: 5, E: 6, E1: 6 };

// ─── DTR C3.2 §7 — Discontinuous heating correction (DB) ────────────────────
// mode_chauf:  "continu" | "semi_continu" | "intermittent"
// inertie:     "forte" | "moyenne" | "faible"
const DB_TABLE = {
  continu:       { forte: 0,  moyenne: 0,  faible: 0  },
  semi_continu:  { forte: 4,  moyenne: 6,  faible: 8  },
  intermittent:  { forte: 7,  moyenne: 10, faible: 14 },
};

// ─── DTR C3.2 §6 — Reference transmission coefficient [W/K·m²] by zone ──────
// Dref limits per heated zone (W/K per m² of floor area):
const DREF_BY_ZONE = { A: 1.1, B: 1.0, C: 0.8, D: 1.1, E: 1.2, E1: 1.3 };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve effective U [W/m²K] for an opaque element given its R-value,
 * surface resistances (determined by group + contact), and optional insulation.
 *
 *   R_total = Rs_int + R_construction + R_insulation + Rs_ext
 *   U_eff   = 1 / R_total
 *
 * @param {number}  rConstruction  – construction-layer R from preset [m²K/W]
 * @param {string}  group          – "vertical" | "roof" | "floor"
 * @param {string}  contact        – "EXT" | "LNC"
 * @param {string}  [isolantMat]   – key in ISOLANT_OPTS
 * @param {number}  [epaisseur]    – insulation thickness [m]
 * @returns {number} U effective [W/m²K]
 */
function resolveU(rConstruction, group, contact, isolantMat, epaisseur) {
  const isLNC = String(contact ?? "EXT").toUpperCase() === "LNC";

  // Surface resistances
  let rs_int, rs_ext;
  if (isLNC) {
    rs_int = RS.lnc.int;
    rs_ext = RS.lnc.lnc;
  } else if (group === "roof") {
    rs_int = RS.roof.int;
    rs_ext = RS.roof.ext;
  } else if (group === "floor") {
    rs_int = RS.floor.int;
    rs_ext = RS.floor.ext;
  } else {
    rs_int = RS.wall.int;
    rs_ext = RS.wall.ext;
  }

  // Insulation resistance
  let r_iso = 0;
  if (isolantMat && isolantMat !== "aucun" && Number(epaisseur) > 0) {
    const opt = ISOLANT_OPTS.find((o) => o.val === isolantMat);
    if (opt && opt.lambda > 0) {
      r_iso = Number(epaisseur) / opt.lambda;
    }
  }

  const r_total = rs_int + Number(rConstruction) + r_iso + rs_ext;
  return r_total > 0 ? 1 / r_total : 0;
}

/**
 * Public helper: given a base R value + optional insulation, return U_eff.
 * Keeps the old API signature for backward compatibility with any callers.
 */
export function calculateUWithInsulation(baseR, isolantMat, epaisseur) {
  return resolveU(baseR, "vertical", "EXT", isolantMat, epaisseur);
}

/** Effective area from a surface object (width×height preferred, then area field). */
function surfaceArea(s) {
  const w = Number(s.width  ?? 0);
  const h = Number(s.height ?? 0);
  if (w > 0 && h > 0) return w * h;
  const a = Number(s.area ?? 0);
  return a > 0 ? a : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * calculateRoomLosses(project, room)
 *
 * Returns:
 *   Qt        – transmission losses [W]
 *   Qt_ponts  – thermal-bridge losses [W]
 *   Qv        – ventilation losses [W]
 *   Cin       – indoor-air heat capacity coefficient [W/K]
 *   Q_total   – design heat load [W]
 *   DT        – transmission coefficient [W/K]
 *   DR        – ventilation coefficient [W/K]
 *   Dref      – reference transmission coefficient [W/K] (DTR §6)
 *   reg_ok    – boolean | null — whether DT ≤ 1.05 × Dref
 *   DB        – discontinuous-heating surplus [W]
 */
export function calculateRoomLosses(project, room) {
  // ── 1. Climate / temperature data ─────────────────────────────────────────
  const wilayaId  = project.info?.wilayaId ?? 16;
  const wilaya    = WILAYAS.find((w) => w.id === wilayaId) ?? WILAYAS[0];
  const zoneKey   = project.info?.climateZone ?? wilaya?.defaultZone ?? "A";
  const T_outdoor = ZONE_BASE_TEMP[zoneKey] ?? 0;
  const T_indoor  = Number(project.info?.indoorSetpoint ?? 20);
  const T_ground  = Number(project.info?.groundTemp ?? 10);
  const DeltaT    = T_indoor - T_outdoor;        // main design ΔT [K]

  // ── 2. Surface loop — transmission losses ─────────────────────────────────
  let DT_sum       = 0;   // transmission coeff [W/K]
  let Qt_ponts_sum = 0;   // thermal bridge losses [W]

  const surfaces = room.surfaces ?? [];

  for (const s of surfaces) {
    const group   = s.group   ?? "vertical";
    const contact = String(s.contact ?? "EXT").toUpperCase();
    const area    = surfaceArea(s);

    if (area <= 0) continue;

    // ── Determine effective U for this element ──────────────────────────────
    let U_eff = 0;

    const typeName = String(s.elementType ?? "");
    const isOpaque =
      !typeName.includes("Fenêtre") &&
      !typeName.includes("Baie")    &&
      !typeName.startsWith("Porte");

    if (contact !== "SOL" && isOpaque) {
      if (typeof s.rValue === "number" && s.rValue > 0) {
        // R-based path (new presets)
        U_eff = resolveU(s.rValue, group, contact, s.isolantMat, s.isolantEpaisseur);
      } else if (typeof s.uValue === "number" && s.uValue > 0) {
        // Legacy U path (old surfaces or imports from CAD without rValue)
        // Apply insulation on top if present
        if (s.isolantMat && s.isolantMat !== "aucun" && Number(s.isolantEpaisseur) > 0) {
          const opt = ISOLANT_OPTS.find((o) => o.val === s.isolantMat);
          if (opt && opt.lambda > 0) {
            const r_iso  = Number(s.isolantEpaisseur) / opt.lambda;
            const r_base = 1 / s.uValue;
            U_eff = 1 / (r_base + r_iso);
          } else {
            U_eff = s.uValue;
          }
        } else {
          U_eff = s.uValue;
        }
      }
    } else if (!isOpaque) {
      // Windows & doors use U/K directly (no surface resistance adjustment)
      U_eff = typeof s.uValue === "number" && s.uValue > 0 ? s.uValue : 0;
    } else if (contact === "SOL") {
      // Ground-floor (Sur Terre-Plein etc.): use rValue or uValue directly
      if (typeof s.rValue === "number" && s.rValue > 0) {
        U_eff = resolveU(s.rValue, "floor", "EXT", s.isolantMat, s.isolantEpaisseur);
      } else if (typeof s.uValue === "number" && s.uValue > 0) {
        U_eff = s.uValue;
      }
    }

    // ── Temperature difference for this element ─────────────────────────────
    let delta_T_elem = DeltaT;

    if (contact === "LNC") {
      // DTR §4.2 — LNC reduction: use user-supplied LNC temp if available,
      // otherwise fall back to a 0.7× reduction factor.
      if (typeof s.lncTemp === "number") {
        delta_T_elem = T_indoor - s.lncTemp;
      } else {
        delta_T_elem = DeltaT * 0.7;
      }
    } else if (contact === "SOL") {
      delta_T_elem = T_indoor - T_ground;
    }

    // ── Transmission loss coefficient for this surface [W/K] ────────────────
    // Normalised to main DeltaT so DT_sum × DeltaT gives correct Qt
    if (DeltaT > 0) {
      DT_sum += U_eff * area * (delta_T_elem / DeltaT);
    }

    // ── Thermal bridges (linear) ─────────────────────────────────────────────
    const psi     = Number(s.psi ?? 0);
    const bridgeL = Number(s.bridgeLength ?? 0);
    if (psi > 0 && bridgeL > 0) {
      Qt_ponts_sum += psi * bridgeL * delta_T_elem;
    }
  }

  const Qt       = DT_sum * DeltaT;
  const Qt_ponts = Qt_ponts_sum;

  // ── 3. Ventilation losses (DTR §5.4) ──────────────────────────────────────
  // Cin = ρ·c·n·V  [W/K]   (ρ·c_air ≈ 0.34 Wh/m³K)
  const volume  = Number(room.volume ?? 0);
  const n_ACH   = Number(room.infiltration ?? 0.5); // air changes per hour
  const Cin     = 0.34 * n_ACH * volume;            // [W/K]
  const Qv      = Cin * DeltaT;

  // ── 4. Discontinuous-heating correction (DTR §7) ──────────────────────────
  const mode_chauf = project.info?.mode_chauf  ?? "continu";
  const inertie    = project.info?.inertie     ?? "forte";
  const db_row     = DB_TABLE[mode_chauf] ?? DB_TABLE.continu;
  const DB_K       = db_row[inertie] ?? 0;          // temperature boost [K]
  const DB         = (DT_sum + Cin) * DB_K;         // extra watts [W]

  // ── 5. Total design heat load ──────────────────────────────────────────────
  const Q_total = Qt + Qt_ponts + Qv + DB;

  // ── 6. Reference coefficient Dref (DTR §6) ────────────────────────────────
  // Dref = Dref_zone × A_floor  [W/K]
  let A_floor = (room.surfaces ?? [])
    .filter((s) => s.group === "floor")
    .reduce((sum, s) => sum + surfaceArea(s), 0);
  if (A_floor <= 0 && volume > 0) A_floor = volume / 2.5; // estimate @ 2.5m ceiling

  const dref_coeff = DREF_BY_ZONE[zoneKey] ?? 1.0;
  const Dref       = dref_coeff * A_floor;

  // ── 7. Regulatory check ───────────────────────────────────────────────────
  const DT     = DT_sum;
  const DR     = Cin;
  const reg_ok = Dref > 0 ? DT <= 1.05 * Dref : null;

  return {
    Qt:       Math.max(0, Qt),
    Qt_ponts: Math.max(0, Qt_ponts),
    Qv:       Math.max(0, Qv),
    Cin,
    Q_total:  Math.max(0, Q_total),
    DT:       Math.max(0, DT),
    DR:       Math.max(0, DR),
    Dref,
    reg_ok,
    DB:       Math.max(0, DB),
  };
}
