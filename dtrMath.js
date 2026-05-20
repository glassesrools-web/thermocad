/**
 * dtrMath.js — DTR C3.2 Heat-Loss Calculation Engine (Advanced)
 *
 * Exports:
 *   gTBE(zone, altitude)                          — base external temperature [C]
 *   gEV(H, roughness)                             — wind exposure coefficient
 *   gKS(z)                                        — ground Ks without insulation (table 5.2)
 *   gKS53(z, r)                                   — ground Ks with horiz. perim. insulation
 *   gKSol(z, type, r)                             — composite ground transmittance
 *   gKS58(z, K)                                   — buried wall transmittance
 *   calculateUWithInsulation(baseR, isolantMat, epaisseur) — effective U [W/m2K]
 *   calculateRoomLosses(project, room)            — per-room loss metrics
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This engine implements the full DTR C3-2 methodology adapted to a per-room
 * evaluation loop. It replaces static fallback values with proper table lookups
 * for base temperature (altitude-dependent), ground losses (perimeter method),
 * hygienic ventilation (Qvmin/Qvmax), wind infiltration (Qs), and LNC tau.
 */

import { ISOLANT_OPTS } from "../data/dtrMaterials.js";
import { WILAYAS, CLIMATE_ZONES } from "../data/algeria_climate.js";
import {
  TBE_T, DREF_T, RS_DTR, KS52, KS53, KS58,
  QVMIN, QVMAX_CUI, QVMAX_SDB, QVMAX_WC,
  PO_T, EV_T, TAU_AUTO, CR_TABLE,
} from "../data/dtrTables.js";

// ─── Precision helpers ───────────────────────────────────────────────────────
const f4 = (v) => +v.toFixed(4);
const f2 = (v) => +v.toFixed(2);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED HELPER FUNCTIONS — DTR C3.2 Table Lookups
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * gTBE — Base external temperature from DTR Table 2.2
 * @param {string} zone — Climate zone (A, B, Bp, C, D, Dp)
 * @param {number} altitude — Site altitude in metres
 * @returns {number|null} tbe in [C], or null if zone/altitude invalid
 */
export function gTBE(zone, altitude) {
  let actualZone = zone;
  if (zone === "Bp") actualZone = "B";
  if (zone === "Dp") actualZone = "D";
  const alt = Number(altitude) || 0;
  const table = TBE_T[actualZone];
  if (!table) return null;
  for (const [lo, hi, tbe] of table) {
    if (alt >= lo && alt < hi) return tbe;
  }
  return null;
}

/**
 * gEV — Wind exposure coefficient from DTR Table 7.4
 * @param {number} H — Building height [m]
 * @param {string} roughness — Roughness class (I..V)
 * @returns {number} EV coefficient
 */
export function gEV(H, roughness) {
  const e = EV_T[roughness] || EV_T.IV;
  for (const [h, v] of e) {
    if (H <= h) return v;
  }
  return e[e.length - 1][1];
}

/**
 * gKS — Ground transmittance without insulation (DTR Table 5.2)
 * @param {number} z — Depth below grade [m] (negative = below ground)
 * @returns {number} Ks [W/mK]
 */
export function gKS(z) {
  for (const [lo, hi, ks] of KS52) {
    if (z >= lo && z < hi) return ks;
  }
  return 0;
}

/**
 * rCol53 — Column index for KS53 table based on insulation R-value
 */
function rCol53(r) {
  if (r < 0.40) return 0;
  if (r < 0.60) return 1;
  if (r < 0.80) return 2;
  if (r < 1.05) return 3;
  if (r < 1.55) return 4;
  if (r < 2.05) return 5;
  return 6;
}

/**
 * gKS53 — Ground transmittance with horizontal perimeter insulation (Table 5.3)
 * @param {number} z — Depth [m]
 * @param {number} r — Insulation R-value [m2K/W]
 * @returns {number} Ks [W/mK]
 */
export function gKS53(z, r) {
  for (const [lo, hi, ks] of KS53) {
    if (z >= lo && z < hi) return ks[rCol53(r)];
  }
  return 0;
}

// Correction factors for insulation variants (Tables 5.4, 5.5, 5.6)
function gCorr54(z) {
  return z <= -0.45 ? 0 : z < -0.20 ? 0.10 : 0.20;
}
function gCorr55(z) {
  return z <= -0.45 ? 0 : z < -0.20 ? 0.05 : 0.10;
}
function gCorr56(z, r) {
  const c = z <= -0.45
    ? [0, 0, 0, 0]
    : z < -0.20
      ? [0.05, 0.05, 0.10, 0.10]
      : [0.15, 0.15, 0.20, 0.25];
  const ci = r < 0.40 ? 0 : r < 0.60 ? 1 : r < 1.05 ? 2 : 3;
  return c[ci];
}

/**
 * gKSol — Composite ground-floor transmittance (DTR 5.2-5.6)
 * @param {number} z — Depth below grade [m]
 * @param {string} type — Insulation type (sans_iso, iso_perimetre, iso_surface, iso_peri_mur, iso_surface_mur)
 * @param {number} r — Insulation R-value [m2K/W]
 * @returns {number} Ks [W/mK]
 */
export function gKSol(z, type, r) {
  if (!type || type === "sans_iso") return gKS(z);
  const base = gKS53(z, r);
  if (type === "iso_perimetre") return base;
  if (type === "iso_surface") return Math.max(0, f4(base - gCorr54(z)));
  if (type === "iso_peri_mur") return Math.max(0, f4(base - gCorr55(z)));
  if (type === "iso_surface_mur") return Math.max(0, f4(base - gCorr56(z, r)));
  return gKS(z);
}

/**
 * kCol58 — Column index for KS58 table based on wall U-value
 */
function kCol58(K) {
  if (K < 0.50) return 0;
  if (K < 0.65) return 1;
  if (K < 0.80) return 2;
  if (K < 1.00) return 3;
  if (K < 1.20) return 4;
  if (K < 1.50) return 5;
  if (K < 1.80) return 6;
  if (K < 2.20) return 7;
  if (K < 2.60) return 8;
  if (K < 3.10) return 9;
  return 10;
}

/**
 * gKS58 — Buried wall transmittance (DTR Table 5.8)
 * @param {number} z — Depth [m]
 * @param {number} K — Wall U-value [W/m2K]
 * @returns {number} Ks [W/mK]
 */
export function gKS58(z, K) {
  if (z >= -0.20) return K;
  for (const [lo, hi, ks] of KS58) {
    if (z >= lo && z < hi) return ks[kCol58(K)];
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * resolveU — Effective U for an opaque element using DTR surface resistances
 */
function resolveU(rConstruction, group, contact, isolantMat, epaisseur) {
  // Determine orientation key for RS_DTR lookup
  let orient = "lateral";
  if (group === "roof") orient = "ascendant";
  else if (group === "floor") orient = "descendant";

  const contactKey = String(contact ?? "EXT").toUpperCase() === "LNC" ? "lnc" : "ext";
  const rsKey = `${orient}_${contactKey}`;
  const rs = RS_DTR[rsKey] ?? 0.17;

  // Insulation resistance
  let r_iso = 0;
  if (isolantMat && isolantMat !== "aucun" && Number(epaisseur) > 0) {
    const opt = ISOLANT_OPTS.find((o) => o.val === isolantMat);
    if (opt && opt.lambda > 0) {
      r_iso = Number(epaisseur) / opt.lambda;
    }
  }

  const r_total = rs + Number(rConstruction) + r_iso;
  return r_total > 0 ? 1 / r_total : 0;
}

/**
 * Public helper: given a base R value + optional insulation, return U_eff.
 */
export function calculateUWithInsulation(baseR, isolantMat, epaisseur) {
  return resolveU(baseR, "vertical", "EXT", isolantMat, epaisseur);
}

/** Effective area from a surface object (width x height preferred, then area field). */
function surfaceArea(s) {
  const w = Number(s.width ?? 0);
  const h = Number(s.height ?? 0);
  if (w > 0 && h > 0) return w * h;
  const a = Number(s.area ?? 0);
  return a > 0 ? a : 0;
}

/**
 * getTau — Resolve LNC reduction factor from surface or fallback
 */
function getTau(surface, fallback = 0.65) {
  if (surface.tau_mode === "auto" && surface.type_lnc) {
    return TAU_AUTO[surface.type_lnc] ?? fallback;
  }
  if (typeof surface.lncTemp === "number") {
    // If user provided an explicit LNC temperature, we compute tau later in the loop
    return null; // signal to use delta_T method
  }
  const parsed = Number(surface.tau);
  if (parsed > 0 && parsed <= 1) return parsed;
  return TAU_AUTO[surface.type_lnc] ?? fallback;
}

// ─── Discontinuous heating cin (DTR 2.9) ─────────────────────────────────────
function getCin(mode_chauf, inertie) {
  if (mode_chauf === "discontinu") {
    return inertie === "forte" ? 0.20 : 0.15;
  }
  return 0.10; // continu
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENGINE — calculateRoomLosses
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * calculateRoomLosses(project, room)
 *
 * Per-room DTR C3.2 heat-loss calculation.
 *
 * Returns:
 *   Qt        – transmission losses through envelope [W]
 *   Qt_ponts  – thermal-bridge losses [W]
 *   Qv        – hygienic ventilation losses [W]
 *   Qs        – wind infiltration losses [W]
 *   Cin       – indoor-air heat capacity coefficient [W/K] (legacy compat)
 *   Q_total   – design heat load [W]
 *   DT        – transmission coefficient [W/K]
 *   DR        – ventilation + infiltration coefficient [W/K]
 *   Dref      – reference transmission coefficient [W/K]
 *   reg_ok    – boolean | null
 *   DB        – discontinuous-heating surplus [W]
 *   tbe       – base external temperature used [C]
 */
export function calculateRoomLosses(project, room) {
  // ── 1. Climate / temperature data ─────────────────────────────────────────
  const wilayaId = project.info?.wilayaId ?? 16;
  const wilaya = WILAYAS.find((w) => w.id === wilayaId) ?? WILAYAS[0];
  const zoneKey = project.info?.climateZone ?? wilaya?.defaultZone ?? "A";
  const altitude = Number(project.info?.altitude ?? 0);

  // Use advanced gTBE with altitude interpolation; fall back to static if zone unknown
  const tbe = gTBE(zoneKey, altitude) ?? 0;
  const T_indoor = Number(project.info?.indoorSetpoint ?? 21);
  const T_ground = Number(project.info?.groundTemp ?? 10);
  const DeltaT = T_indoor - tbe;

  // ── 2. Surface loop — transmission losses ─────────────────────────────────
  let DT_sum = 0;       // total transmission coefficient [W/K]
  let Qt_ponts_sum = 0; // thermal bridge losses [W]
  let Dsol = 0;         // ground losses coefficient [W/K]

  const surfaces = room.surfaces ?? [];

  for (const s of surfaces) {
    const group = s.group ?? "vertical";
    const contact = String(s.contact ?? "EXT").toUpperCase();
    const area = surfaceArea(s);

    if (area <= 0) continue;

    const typeName = String(s.elementType ?? "");
    const isOpaque =
      !typeName.includes("Fen\u00eatre") &&
      !typeName.includes("Baie") &&
      !typeName.startsWith("Porte");

    // ── GROUND CONTACT (SOL) — use perimeter method ─────────────────────────
    if (contact === "SOL") {
      const perim = Number(s.perimetre ?? 0);
      const z = Number(s.z ?? 0);
      const typeIso = s.type_iso || "sans_iso";
      const rIso = Number(s.r_iso ?? 1.0);

      if (perim > 0) {
        // Floor on ground: Dsol = Ks * P
        const ks = gKSol(z, typeIso, rIso);
        Dsol += ks * perim;
      } else if (Number(s.rValue) > 0 || Number(s.uValue) > 0) {
        // Fallback: if no perimeter data, use flat U * A approach (legacy)
        let U_eff = 0;
        if (Number(s.rValue) > 0) {
          U_eff = resolveU(s.rValue, "floor", "EXT", s.isolantMat, s.isolantEpaisseur);
        } else {
          U_eff = Number(s.uValue);
        }
        const delta_sol = T_indoor - T_ground;
        if (DeltaT > 0) {
          DT_sum += U_eff * area * (delta_sol / DeltaT);
        }
      }

      // Thermal bridges on ground floor
      const psi = Number(s.psi ?? 0);
      const bridgeL = Number(s.bridgeLength ?? 0);
      if (psi > 0 && bridgeL > 0) {
        Qt_ponts_sum += psi * bridgeL * (T_indoor - T_ground);
      }
      continue;
    }

    // ── BURIED WALL (mur_enterre) ───────────────────────────────────────────
    if (s.type_iso === "mur_enterre" || s.buried) {
      const perim = Number(s.perimetre ?? s.bridgeLength ?? 0);
      const z = Number(s.z ?? -1);
      const R = Number(s.rValue ?? 0);
      if (perim > 0 && R > 0) {
        const rsKey = RS_DTR.lateral_ext ?? 0.17;
        const K = 1 / (rsKey + R);
        const ks = gKS58(z, K);
        Dsol += ks * perim;
      }
      continue;
    }

    // ── OPAQUE SURFACES (walls, roofs, non-SOL floors) ──────────────────────
    let U_eff = 0;

    if (isOpaque) {
      if (Number(s.rValue) > 0) {
        U_eff = resolveU(s.rValue, group, contact, s.isolantMat, s.isolantEpaisseur);
      } else if (Number(s.uValue) > 0) {
        // Legacy U path
        if (s.isolantMat && s.isolantMat !== "aucun" && Number(s.isolantEpaisseur) > 0) {
          const opt = ISOLANT_OPTS.find((o) => o.val === s.isolantMat);
          if (opt && opt.lambda > 0) {
            const r_iso = Number(s.isolantEpaisseur) / opt.lambda;
            const r_base = 1 / Number(s.uValue);
            U_eff = 1 / (r_base + r_iso);
          } else {
            U_eff = Number(s.uValue);
          }
        } else {
          U_eff = Number(s.uValue);
        }
      }
    } else {
      // Windows & doors — U/K directly (no Rs adjustment per DTR for transparent)
      U_eff = Number(s.uValue) > 0 ? Number(s.uValue) : 0;
    }

    // ── Temperature difference / tau for this element ───────────────────────
    let delta_T_elem = DeltaT;

    if (contact === "LNC") {
      const tau = getTau(s);
      if (tau === null && typeof s.lncTemp === "number") {
        // User specified explicit LNC temperature
        delta_T_elem = T_indoor - s.lncTemp;
      } else {
        // Use tau reduction: delta_T_elem = tau * DeltaT
        delta_T_elem = (tau ?? 0.65) * DeltaT;
      }
    }

    // ── Accumulate transmission coefficient ─────────────────────────────────
    if (DeltaT > 0) {
      DT_sum += U_eff * area * (delta_T_elem / DeltaT);
    }

    // ── Thermal bridges (linear) ────────────────────────────────────────────
    const psi = Number(s.psi ?? 0);
    const bridgeL = Number(s.bridgeLength ?? 0);
    if (psi > 0 && bridgeL > 0) {
      Qt_ponts_sum += psi * bridgeL * delta_T_elem;
    }
  }

  // Add ground losses to DT (Dsol contributes directly to DT per DTR)
  DT_sum += Dsol;

  // Thermal bridge default: Dli = 20% of envelope Ds (excluding Dsol) per DTR
  // Already handled by explicit psi*L in the surface loop if data is available.
  // If no explicit bridges were given, apply the 20% rule as fallback.
  const hasExplicitBridges = Qt_ponts_sum > 0;
  const Ds_envelope = DT_sum - Dsol;
  if (!hasExplicitBridges && Ds_envelope > 0) {
    const Dli_fallback = 0.20 * Ds_envelope;
    DT_sum += Dli_fallback;
  }

  const Qt = DT_sum * DeltaT;
  const Qt_ponts = Qt_ponts_sum;

  // ── 3. Ventilation losses — DTR Chapter 7 ─────────────────────────────────
  const volume = Number(room.volume ?? 0);
  const np = Math.min(Number(project.info?.nb_pieces ?? 3), 5);
  const nsdb = Number(project.info?.nb_sdb ?? 1);
  const nae = Number(project.info?.nb_autre_eau ?? 0);
  const nwc = Number(project.info?.nb_wc ?? 1);

  // Qvmin (m3/h) — extends linearly beyond 5 rooms
  const nb_real = Number(project.info?.nb_pieces ?? 3);
  const Qvmin_v = nb_real <= 5
    ? (QVMIN[np] ?? 75)
    : 110 + (nb_real - 5) * 10;

  // Qvmax (m3/h)
  const Qvmax_v =
    (QVMAX_CUI[np] ?? 105) +
    (QVMAX_SDB[np] ?? 15) * nsdb +
    15 * nae +
    (QVMAX_WC[np] ?? 15) * nwc;

  // Reference ventilation rate
  const Qvref = f2((5 * Qvmin_v + Qvmax_v) / 6);

  // Effective ventilation: max of 0.6*Vh or Qvref
  const Qv_m3h = Math.max(0.6 * volume, Qvref);
  const DRv = 0.34 * Qv_m3h; // W/K from ventilation

  // ── 4. Wind infiltration Qs — DTR 7.3 ────────────────────────────────────
  let Qs_m3h = 0;
  const ouvrants = project.info?.ouvrants_vent ?? [];
  for (const o of ouvrants) {
    const A = Number(o.surface ?? 0);
    if (A <= 0) continue;
    const po = PO_T[o.type] ?? 4.0;
    const H = Number(o.H ?? 4);
    const rug = o.rugosite || "IV";
    Qs_m3h += po * A * Math.sqrt(gEV(H, rug));
  }
  Qs_m3h = f2(Qs_m3h / 2); // divided by 2 per DTR formula

  const DRs = 0.34 * Qs_m3h; // W/K from infiltration
  const DR_total = f4(DRv + DRs);

  const Qv = DRv * DeltaT;
  const Qs = DRs * DeltaT;

  // Legacy compatibility: Cin as ventilation coefficient
  const Cin = DR_total;

  // ── 5. Correction factors cr and cin (DTR 2.9) ────────────────────────────
  const type_chauf = project.info?.type_chauf ?? "central_partiel";
  const mode_chauf = project.info?.mode_chauf ?? "continu";
  const inertie = project.info?.inertie ?? "forte";

  const cr = CR_TABLE[type_chauf] ?? 0.10;
  const cin_coeff = getCin(mode_chauf, inertie);
  const correction = Math.max(cr, cin_coeff);

  // ── 6. Total design heat load — DTR Equation (2.9) ────────────────────────
  // Q = (tbi - tbe) * [(1 + max(cr, cin)) * DT + (1 + cr) * DR]
  const Q_total = DeltaT * ((1 + correction) * DT_sum + (1 + cr) * DR_total);

  // DB: simplified surplus for discontinuous heating (legacy compatibility)
  const DB = correction > 0.10 ? correction * (DT_sum + DR_total) * DeltaT : 0;

  // ── 7. Reference coefficient Dref ─────────────────────────────────────────
  const type_log = project.info?.type_log ?? "collectif";
  const cf = (DREF_T[type_log] ?? DREF_T.collectif)[zoneKey] ?? [1, 2.4, 1.2, 3.5, 4.5];

  // Estimate S1..S5 from room surfaces (simplified per-room Dref)
  let S1 = 0, S2 = 0, S3 = 0, S4 = 0, S5 = 0;
  for (const s of surfaces) {
    const a = surfaceArea(s);
    if (a <= 0) continue;
    const g = s.group ?? "vertical";
    const typeName = String(s.elementType ?? "");
    const isWin = typeName.includes("Fen\u00eatre") || typeName.includes("Baie");
    const isDoor = typeName.startsWith("Porte");

    if (g === "roof") S1 += a;
    else if (g === "floor") S2 += a;
    else if (isWin) S5 += a;
    else if (isDoor) S4 += a;
    else S3 += a; // walls
  }

  // Fallback floor area estimate
  if (S2 <= 0 && volume > 0) S2 = volume / 2.5;

  const Dref = f4(cf[0] * S1 + cf[1] * S2 + cf[2] * S3 + cf[3] * S4 + cf[4] * S5);

  // ── 8. Regulatory check ───────────────────────────────────────────────────
  const DT = DT_sum;
  const reg_ok = Dref > 0 ? DT <= 1.05 * Dref : null;

  return {
    Qt: Math.max(0, Qt),
    Qt_ponts: Math.max(0, Qt_ponts),
    Qv: Math.max(0, Qv),
    Qs: Math.max(0, Qs),
    Cin,
    Q_total: Math.max(0, Q_total),
    DT: Math.max(0, DT),
    DR: Math.max(0, DR_total),
    Dref,
    reg_ok,
    DB: Math.max(0, DB),
    tbe,
  };
}
