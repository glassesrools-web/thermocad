/**
 * DTR C3.2 — Thermal Loss Math Engine
 * Implements per-room heat loss calculation per DTR C3-2 (Algerian standard).
 *
 * Exports:
 *   calculateUWithInsulation(baseU, isolantMat, epaisseur) → U_final [W/m²K]
 *   calculateRoomLosses(project, room)                     → loss metrics object
 */

import { ISOLANT_OPTS } from "../data/dtrMaterials.js";
import { CLIMATE_ZONES, WILAYAS } from "../data/algeria_climate.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** DTR C3.2 §4.1 — Surface resistances [m²K/W] */
const RS = {
  lateral_ext:    0.17,
  ascendant_ext:  0.14,
  descendant_ext: 0.22,
  lateral_lnc:    0.22,
  ascendant_lnc:  0.18,
  descendant_lnc: 0.34,
};

/** DTR C3.2 Tableau 2.1 — Reference transmission coefficients Dref
 *  Shape: { buildingType: { zone: [a_S1, b_S2, c_S3, d_S4, e_S5] } }
 *  Dref = a*S1 + b*S2 + c*S3 + d*S4 + e*S5
 *  Source: DTR C3.2 Tableau 2.1 (corrected — confirmed by PFC thesis p.24)
 */
const DREF_T = {
  individuel: {
    A:  [0.9, 2, 1.2, 3, 3.8],
    A1: [0.9, 2, 1.2, 3, 3.8],
    B:  [0.9, 2, 1.0, 3, 3.8],
    Bp: [0.9, 2, 1.0, 3, 3.8],
    C:  [0.9, 2, 1.0, 3, 3.8],
    D:  [0.9, 2, 1.2, 3, 3.8],
    Dp: [0.9, 2, 1.2, 3, 3.8],
    E:  [0.9, 2, 1.0, 3, 3.8],
    E1: [0.9, 2, 1.0, 3, 3.8],
  },
  collectif: {
    A:  [0.9,  2, 1.2, 3, 3.8],
    A1: [0.9,  2, 1.2, 3, 3.8],
    B:  [0.75, 2, 1.0, 3, 3.8],
    Bp: [0.75, 2, 1.0, 3, 3.8],
    C:  [0.75, 2, 1.0, 3, 3.8],
    D:  [0.9,  2, 1.2, 3, 3.8],
    Dp: [0.9,  2, 1.2, 3, 3.8],
    E:  [0.75, 2, 1.0, 3, 3.8],
    E1: [0.75, 2, 1.0, 3, 3.8],
  },
};

/** DTR C3.2 Table 5.2 — Ground floor U [W/m²K] by depth z (no insulation) */
const KS52 = [
  [-9999, -6,    0   ],
  [-6,    -4,    0.20],
  [-4,    -2.5,  0.40],
  [-2.5,  -1.8,  0.60],
  [-1.8,  -1.2,  0.80],
  [-1.2,  -0.7,  1.00],
  [-0.7,  -0.4,  1.20],
  [-0.4,  -0.2,  1.40],
  [-0.2,   0.25, 1.75],
  [ 0.25,  0.45, 2.10],
  [ 0.45,  1.05, 2.35],
  [ 1.05, 9999,  2.55],
];

/** DTR C3.2 Table 5.3 — Ground floor U with perimeter insulation */
const KS53 = [
  [-9999, -6,    [0,    0,    0,    0,    0,    0,    0   ]],
  [-6,    -4,    [0.20, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15]],
  [-4,    -2.5,  [0.40, 0.35, 0.35, 0.35, 0.35, 0.30, 0.30]],
  [-2.5,  -1.8,  [0.55, 0.55, 0.50, 0.50, 0.45, 0.45, 0.40]],
  [-1.8,  -1.2,  [0.70, 0.70, 0.65, 0.60, 0.60, 0.55, 0.45]],
  [-1.2,  -0.7,  [0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.55]],
  [-0.7,  -0.4,  [1.05, 1.00, 0.95, 0.90, 0.80, 0.75, 0.65]],
  [-0.4,  -0.2,  [1.20, 1.10, 1.05, 1.00, 0.90, 0.80, 0.70]],
  [-0.2,   0.25, [1.45, 1.35, 1.25, 1.15, 1.05, 0.95, 0.85]],
  [ 0.25,  0.45, [1.70, 1.55, 1.45, 1.30, 1.20, 1.05, 0.95]],
  [ 0.45,  1.05, [1.90, 1.70, 1.55, 1.45, 1.30, 1.15, 1.00]],
  [ 1.05, 9999,  [2.05, 1.85, 1.70, 1.55, 1.40, 1.25, 1.10]],
];

/** DTR C3.2 Table 5.8 — Buried wall U values */
const KS58 = [
  [-9999, -6,   [1.40, 1.65, 1.85, 2.05, 2.25, 2.45, 2.65, 2.80, 3.00, 3.20, 3.40]],
  [-6,    -5,   [1.30, 1.50, 1.70, 1.90, 2.05, 2.25, 2.45, 2.65, 2.85, 3.00, 3.20]],
  [-5,    -4,   [1.15, 1.35, 1.50, 1.65, 1.90, 2.05, 2.25, 2.45, 2.65, 2.80, 3.00]],
  [-4,    -3,   [1.00, 1.15, 1.30, 1.45, 1.65, 1.85, 2.00, 2.20, 2.35, 2.55, 2.70]],
  [-3,    -2.5, [0.85, 1.00, 1.15, 1.30, 1.45, 1.65, 1.80, 2.00, 2.15, 2.30, 2.50]],
  [-2.5,  -2,   [0.70, 0.85, 1.00, 1.15, 1.30, 1.45, 1.65, 1.80, 1.95, 2.10, 2.30]],
  [-2,    -1.5, [0.60, 0.70, 0.85, 1.00, 1.10, 1.25, 1.40, 1.55, 1.75, 1.90, 2.05]],
  [-1.5,  -1,   [0.45, 0.55, 0.65, 0.75, 0.90, 1.00, 1.15, 1.30, 1.45, 1.60, 1.75]],
  [-1,    -0.7, [0.35, 0.40, 0.50, 0.60, 0.65, 0.80, 0.90, 1.05, 1.15, 1.30, 1.40]],
  [-0.7,  -0.4, [0.20, 0.30, 0.35, 0.40, 0.50, 0.55, 0.65, 0.75, 0.85, 0.95, 1.10]],
  [-0.4,  -0.2, [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.55, 0.60, 0.70]],
];

// DTR §3.2 — fallback base temperatures by zone
const ZONE_BASE_TEMP = { A: 4, B: 2, Bp: 2, C: -2, D: 5, Dp: 5, E: 6, E1: 6 };

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const f4 = (v) => +Number(v).toFixed(4);
const n  = (v) => parseFloat(v) || 0;

/** Interpolate KS52 table for no-insulation ground floor */
function gKS52(z) {
  for (const [lo, hi, ks] of KS52) if (z >= lo && z < hi) return ks;
  return 0;
}

/** Column index for R-value in KS53 table */
function rCol53(r) {
  return r < 0.40 ? 0 : r < 0.60 ? 1 : r < 0.80 ? 2 : r < 1.05 ? 3 : r < 1.55 ? 4 : r < 2.05 ? 5 : 6;
}

/** Interpolate KS53 table for insulated ground floor */
function gKS53(z, r) {
  for (const [lo, hi, ks] of KS53) if (z >= lo && z < hi) return ks[rCol53(r)];
  return 0;
}

const gCorr54 = (z) => z <= -0.45 ? 0 : z < -0.20 ? 0.10 : 0.20;
const gCorr55 = (z) => z <= -0.45 ? 0 : z < -0.20 ? 0.05 : 0.10;
const gCorr56 = (z, r) => {
  const c = z <= -0.45 ? [0, 0, 0, 0] : z < -0.20 ? [0.05, 0.05, 0.10, 0.10] : [0.15, 0.15, 0.20, 0.25];
  const ci = r < 0.40 ? 0 : r < 0.60 ? 1 : r < 1.05 ? 2 : 3;
  return c[ci];
};

/** Full ground-floor U-value selector with insulation type */
function gKSol(z, type, r) {
  if (!type || type === "sans_iso") return gKS52(z);
  const base = gKS53(z, r);
  if (type === "iso_perimetre")  return base;
  if (type === "iso_surface")    return Math.max(0, f4(base - gCorr54(z)));
  if (type === "iso_peri_mur")   return Math.max(0, f4(base - gCorr55(z)));
  if (type === "iso_surface_mur")return Math.max(0, f4(base - gCorr56(z, r)));
  return gKS52(z);
}

/** Column index for KS58 table (buried walls) */
function kCol58(K) {
  return K < 0.50 ? 0 : K < 0.65 ? 1 : K < 0.80 ? 2 : K < 1.00 ? 3 : K < 1.20 ? 4 :
         K < 1.50 ? 5 : K < 1.80 ? 6 : K < 2.20 ? 7 : K < 2.60 ? 8 : K < 3.10 ? 9 : 10;
}

/** Interpolate KS58 for buried walls */
function gKS58(z, K) {
  if (z >= -0.20) return K;
  for (const [lo, hi, ks] of KS58) if (z >= lo && z < hi) return ks[kCol58(K)];
  return 0;
}

/** Compute effective area from surface object (width×height fallback to area) */
function calcArea(surf) {
  const w = Number(surf.width);
  const h = Number(surf.height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return w * h;
  const a = Number(surf.area);
  return Number.isFinite(a) && a > 0 ? a : 0;
}

/** τ coefficient for LNC elements */
function getTau(surf) {
  const manual = parseFloat(surf?.tau);
  if (Number.isFinite(manual) && manual > 0) return manual;
  return 0.65; // DTR default
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le nouveau coefficient U si un isolant est appliqué à la paroi.
 * Formule: R_total = R_paroi + R_isolant = (1 / U_initial) + (Epaisseur / Lambda)
 * U_final = 1 / R_total
 */
export const calculateUWithInsulation = (baseU, isolantMat, epaisseur) => {
  if (!isolantMat || isolantMat === "aucun" || !baseU) return baseU;

  const isolant = ISOLANT_OPTS.find((opt) => opt.val === isolantMat);
  if (!isolant || !isolant.lambda) return baseU;

  const rParoi   = 1 / baseU;
  const rIsolant = epaisseur / isolant.lambda;
  const rTotal   = rParoi + rIsolant;

  return 1 / rTotal;
};

/**
 * calculateRoomLosses(project, room)
 *
 * Calculates per-room heat transmission and ventilation losses per DTR C3-2.
 *
 * @param {object} project  – project data (info, locals…)
 * @param {object} room     – room object with surfaces[], volume, infiltration
 * @returns {{
 *   Qt: number,       transmission loss coefficient (W/K)
 *   Qt_ponts: number, thermal bridge contribution (W/K)
 *   Qv: number,       ventilation loss (W/K)
 *   Cin: number,      ventilation correction factor
 *   Q_total: number,  design heat load (W)
 *   DT: number,       total transmission coeff DT (W/K)
 *   DR: number,       ventilation coeff DR (W/K)
 *   Dref: number,     reference coeff Dref (W/K)
 *   reg_ok: boolean,  DTR conformity
 *   DB: number        base design load (W)
 * }}
 */
export function calculateRoomLosses(project, room) {
  // ── Resolve climate parameters ───────────────────────────────────────────
  const wilayaId   = project?.info?.wilayaId ?? 16;
  const wilaya     = WILAYAS?.find((w) => w.id === wilayaId) ?? WILAYAS?.[0];
  const zoneKey    = project?.info?.climateZone ?? wilaya?.defaultZone ?? "A";
  const zone       = CLIMATE_ZONES?.[zoneKey] ?? CLIMATE_ZONES?.A;
  const T_outdoor  = zone?.baseTemp ?? ZONE_BASE_TEMP[zoneKey] ?? 0;
  const T_indoor   = Number(project?.info?.indoorSetpoint  ?? 20);
  const T_ground   = Number(project?.info?.groundTemp      ?? 10);
  const buildType  = project?.info?.buildingType ?? "collectif";
  const dT         = T_indoor - T_outdoor;          // ΔT [K]
  const dT_ground  = T_indoor - T_ground;           // ΔT vs ground

  const surfaces = room?.surfaces ?? [];

  let Qt = 0;       // transmission coeff sum  [W/K]
  let Qt_ponts = 0; // thermal bridges         [W/K]
  let S1 = 0, S2 = 0, S3 = 0, S4 = 0, S5 = 0; // Dref area accumulators

  for (const surface of surfaces) {
    const group   = surface.group ?? "vertical";
    const contact = String(surface.contact ?? "EXT").toUpperCase();
    const area    = calcArea(surface);

    // ── Apply insulation to get effective U ────────────────────────
    let baseU = parseFloat(surface.uValue) || 0;
    // Appliquer l'isolant si défini
    const u = calculateUWithInsulation(baseU, surface.isolantMat, surface.isolantEpaisseur);

    // Skip surfaces with no useful data
    if (!area || !u) {
      // Still accumulate Dref areas for valid areas even with u=0
      // (only if it's a meaningful surface type for conformity check)
    }

    // ── Contact type handling ──────────────────────────────────────
    const isLNC  = contact === "LNC";
    const isSOL  = contact === "SOL";
    const tau    = isLNC ? getTau(surface) : 1.0;

    // ── Element type classification ────────────────────────────────
    const typeName = surface.elementType ?? "";
    const isWindow = typeName.includes("Fenêtre") || typeName.includes("Baie");
    const isDoor   = typeName.startsWith("Porte") && !typeName.includes("Fenêtre");

    // ── Thermal bridge ─────────────────────────────────────────────
    const psi          = parseFloat(surface.psi)          || 0;
    const bridgeLength = parseFloat(surface.bridgeLength) || 0;
    if (psi && bridgeLength) {
      Qt_ponts += tau * psi * bridgeLength;
    }

    // ── Surface transmission ───────────────────────────────────────
    if (area > 0 && u > 0) {
      if (isSOL) {
        // Ground floor: use z-based U factor from DTR tables
        const z       = parseFloat(surface.z)       || 0;
        const type_iso= surface.type_iso            || "sans_iso";
        const r_iso   = parseFloat(surface.r_iso)   || 1.0;
        const perimetre = parseFloat(surface.perimetre) || 0;
        const ks = gKSol(z, type_iso, r_iso);
        if (perimetre > 0) {
          Qt += ks * perimetre;
          S2 += area;
        }
      } else {
        Qt += tau * u * area;

        // ── Dref area classification ───────────────────────────────
        if (group === "roof" || typeName.includes("Toiture") || typeName.includes("Plafond")) {
          S1 += area;
        } else if (group === "floor" || typeName.includes("Plancher")) {
          S2 += area;
        } else if (isWindow || typeName.includes("Baie")) {
          S5 += area;
        } else if (isDoor) {
          S4 += area;
        } else {
          // Wall (mur)
          S3 += area;
        }
      }
    }
  }

  // ── Thermal bridges total ────────────────────────────────────────────────
  Qt += Qt_ponts;

  // ── Ventilation losses ───────────────────────────────────────────────────
  const volume      = Number(room?.volume       ?? 0);
  const infiltration= Number(room?.infiltration ?? 0.5); // ACH
  const rho_cp      = 0.34; // W·h/(m³·K)  ≡  0.34 Wh/m³K
  const Qv = rho_cp * infiltration * volume; // [W/K]

  // ── Correction factor Cin ────────────────────────────────────────────────
  // DTR §2.9: cin applies ONLY to discontinuous heating.
  // Continuous heating → cin = 0 (no intermittency surcharge).
  const mode_chauf = project?.info?.mode_chauf ?? "continu";
  const inertie    = project?.info?.inertie    ?? "forte";
  const Cin = mode_chauf === "discontinu"
    ? (inertie === "forte" ? 1.20 : 1.15)
    : 0; // continu — no intermittency correction

  // ── Dref conformity check ────────────────────────────────────────────────
  const drefCoefs = (DREF_T[buildType] ?? DREF_T.collectif)[zoneKey] ?? [1.10, 2.40, 1.20, 3.50, 4.50];
  const Dref = f4(drefCoefs[0] * S1 + drefCoefs[1] * S2 + drefCoefs[2] * S3 + drefCoefs[3] * S4 + drefCoefs[4] * S5);
  const DT   = f4(Qt);
  const DR   = f4(Qv);
  const reg_ok = Dref > 0 ? DT <= 1.05 * Dref : null;

  // ── Design heat load ─────────────────────────────────────────────────────
  // Guard: if DeltaT=0 (indoor=outdoor), heat load is zero — avoid ×0 artifacts.
  const DeltaT  = dT;
  const Q_total = DeltaT > 0
    ? (DT + DR) * DeltaT * (1 + Cin)
    : 0;
  const DB      = DeltaT > 0 ? (DT + DR) * DeltaT : 0;

  return {
    Qt:       f4(Qt),
    Qt_ponts: f4(Qt_ponts),
    Qv:       f4(Qv),
    Cin,
    Q_total:  f4(Q_total),
    DT,
    DR,
    Dref,
    reg_ok,
    DB: f4(DB),
  };
}