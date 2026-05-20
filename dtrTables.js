/**
 * dtrTables.js — DTR C3.2 Official Lookup Tables & Constants
 *
 * All matrices and constants extracted from the official DTR C3-2 regulation.
 * Used by dtrMath.js for heat-loss calculations.
 */

// ─── Table 2.2 — Base external temperature by zone and altitude ──────────────
// Shape: { zone: [[altMin, altMax, tbe], ...] }
export const TBE_T = {
  A:  [[0, 300, 6], [300, 500, 3], [500, 1000, 1], [1000, 99999, -1]],
  B:  [[0, 500, 2], [500, 1000, 1], [1000, 99999, -1]],
  Bp: [[0, 500, 2], [500, 1000, 1], [1000, 99999, -1]],  // same as B per DTR
  C:  [[500, 1000, -2], [1000, 99999, -4]],
  D:  [[0, 1000, 5], [1000, 99999, 4]],
  Dp: [[0, 1000, 5], [1000, 99999, 4]],  // same as D per DTR
};

// ─── Table 2.1 — Reference transmission coefficients Dref ────────────────────
// Shape: { buildingType: { zone: [a_S1, b_S2, c_S3, d_S4, e_S5] } }
// Dref = a*S1 + b*S2 + c*S3 + d*S4 + e*S5
export const DREF_T = {
  individuel: {
    A: [1.10, 2.40, 1.40, 3.50, 4.50],
    B: [1.10, 2.40, 1.20, 3.50, 4.50],
    Bp: [1.10, 2.40, 1.20, 3.50, 4.50],
    C: [1.10, 2.40, 1.20, 3.50, 4.50],
    D: [2.40, 3.40, 1.40, 3.50, 4.50],
    Dp: [2.40, 3.40, 1.40, 3.50, 4.50],
  },
  collectif: {
    A: [1.10, 2.40, 1.20, 3.50, 4.50],
    B: [0.90, 2.40, 1.20, 3.50, 4.50],
    Bp: [0.90, 2.40, 1.20, 3.50, 4.50],
    C: [0.85, 2.40, 1.20, 3.50, 4.50],
    D: [2.40, 3.40, 1.40, 3.50, 4.50],
    Dp: [2.40, 3.40, 1.40, 3.50, 4.50],
  },
};

// ─── Table 3.1 — Surface thermal resistances Rs (m²K/W) ─────────────────────
// Keys: {orientation}_{contact}   orientation: lateral|ascendant|descendant
export const RS_DTR = {
  lateral_ext: 0.17,
  ascendant_ext: 0.14,
  descendant_ext: 0.22,
  lateral_lnc: 0.22,
  ascendant_lnc: 0.18,
  descendant_lnc: 0.34,
};

// ─── Table 5.2 — Ground transmittance Ks (no insulation) ────────────────────
// Shape: [[zMin, zMax, Ks], ...]   z = depth below grade (negative = below)
export const KS52 = [
  [-9999, -6, 0],
  [-6, -4, 0.20],
  [-4, -2.5, 0.40],
  [-2.5, -1.8, 0.60],
  [-1.8, -1.2, 0.80],
  [-1.2, -0.7, 1.00],
  [-0.7, -0.4, 1.20],
  [-0.4, -0.2, 1.40],
  [-0.2, 0.25, 1.75],
  [0.25, 0.45, 2.10],
  [0.45, 1.05, 2.35],
  [1.05, 9999, 2.55],
];

// ─── Table 5.3 — Ground transmittance with horizontal perimeter insulation ───
// Shape: [[zMin, zMax, [Ks for R columns]], ...]
// R columns: <0.40, 0.40-0.60, 0.60-0.80, 0.80-1.05, 1.05-1.55, 1.55-2.05, >2.05
export const KS53 = [
  [-9999, -6, [0, 0, 0, 0, 0, 0, 0]],
  [-6, -4, [0.20, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15]],
  [-4, -2.5, [0.40, 0.35, 0.35, 0.35, 0.35, 0.30, 0.30]],
  [-2.5, -1.8, [0.55, 0.55, 0.50, 0.50, 0.45, 0.45, 0.40]],
  [-1.8, -1.2, [0.70, 0.70, 0.65, 0.60, 0.60, 0.55, 0.45]],
  [-1.2, -0.7, [0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.55]],
  [-0.7, -0.4, [1.05, 1.00, 0.95, 0.90, 0.80, 0.75, 0.65]],
  [-0.4, -0.2, [1.20, 1.10, 1.05, 1.00, 0.90, 0.80, 0.70]],
  [-0.2, 0.25, [1.45, 1.35, 1.25, 1.15, 1.05, 0.95, 0.85]],
  [0.25, 0.45, [1.70, 1.55, 1.45, 1.30, 1.20, 1.05, 0.95]],
  [0.45, 1.05, [1.90, 1.70, 1.55, 1.45, 1.30, 1.15, 1.00]],
  [1.05, 9999, [2.05, 1.85, 1.70, 1.55, 1.40, 1.25, 1.10]],
];

// ─── Table 5.8 — Buried wall transmittance ───────────────────────────────────
// Shape: [[zMin, zMax, [Ks for K columns]], ...]
// K columns by wall U-value: <0.50, 0.50-0.65, ..., >3.10
export const KS58 = [
  [-9999, -6, [1.40, 1.65, 1.85, 2.05, 2.25, 2.45, 2.65, 2.80, 3.00, 3.20, 3.40]],
  [-6, -5, [1.30, 1.50, 1.70, 1.90, 2.05, 2.25, 2.45, 2.65, 2.85, 3.00, 3.20]],
  [-5, -4, [1.15, 1.35, 1.50, 1.65, 1.90, 2.05, 2.25, 2.45, 2.65, 2.80, 3.00]],
  [-4, -3, [1.00, 1.15, 1.30, 1.45, 1.65, 1.85, 2.00, 2.20, 2.35, 2.55, 2.70]],
  [-3, -2.5, [0.85, 1.00, 1.15, 1.30, 1.45, 1.65, 1.80, 2.00, 2.15, 2.30, 2.50]],
  [-2.5, -2, [0.70, 0.85, 1.00, 1.15, 1.30, 1.45, 1.65, 1.80, 1.95, 2.10, 2.30]],
  [-2, -1.5, [0.60, 0.70, 0.85, 1.00, 1.10, 1.25, 1.40, 1.55, 1.75, 1.90, 2.05]],
  [-1.5, -1, [0.45, 0.55, 0.65, 0.75, 0.90, 1.00, 1.15, 1.30, 1.45, 1.60, 1.75]],
  [-1, -0.7, [0.35, 0.40, 0.50, 0.60, 0.65, 0.80, 0.90, 1.05, 1.15, 1.30, 1.40]],
  [-0.7, -0.4, [0.20, 0.30, 0.35, 0.40, 0.50, 0.55, 0.65, 0.75, 0.85, 0.95, 1.10]],
  [-0.4, -0.2, [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.55, 0.60, 0.70]],
];

// ─── Table 7.1 — Minimum ventilation flow rates Qvmin (m³/h) ────────────────
// Key = number of habitable rooms (capped at 5)
export const QVMIN = { 1: 25, 2: 50, 3: 75, 4: 100, 5: 110 };

// ─── Table 7.1 — Maximum extraction rates (m³/h) ────────────────────────────
export const QVMAX_CUI = { 1: 75, 2: 90, 3: 105, 4: 120, 5: 135 };
export const QVMAX_SDB = { 1: 15, 2: 15, 3: 30, 4: 30, 5: 30 };
export const QVMAX_WC  = { 1: 15, 2: 15, 3: 15, 4: 30, 5: 30 };

// ─── Table 7.3 — Air permeability coefficients PO (m³/h/m²) ─────────────────
export const PO_T = {
  fenetre: 4.0,
  porte_joint: 1.2,
  porte: 6.0,
  double_fenetre: 2.4,
};

// ─── Table 7.4 — Wind exposure coefficient EV by roughness class ─────────────
// Shape: { class: [[height, EV], ...] }   — interpolate by building height H
export const EV_T = {
  V:   [[4, 0.40], [7, 1.10], [11, 1.76], [18, 2.57], [30, 3.50], [50, 4.47]],
  IV:  [[4, 1.47], [7, 2.30], [11, 3.00], [18, 3.87], [30, 4.80], [50, 5.78]],
  III: [[4, 2.71], [7, 3.51], [11, 4.19], [18, 4.97], [30, 5.80], [50, 6.66]],
  II:  [[4, 4.06], [7, 4.82], [11, 5.46], [18, 6.17], [30, 6.93], [50, 7.71]],
  I:   [[4, 6.36], [7, 7.08], [11, 7.67], [18, 8.32], [30, 9.02], [50, 9.72]],
};

// ─── Table 4.2 — LNC temperature reduction coefficients TAU ──────────────────
export const TAU_AUTO = {
  // Circulations (hallways, stairwells)
  circ_ouverte: 1.0,
  circ_directe_ne: 0.30,
  circ_directe_i: 0.45,
  circ_indirecte_ne_ne: 0.20,
  circ_indirecte_ne_i: 0.40,
  circ_indirecte_i_ne: 0.30,
  circ_indirecte_i_i: 0.50,
  circ_centrale_ne: 0.10,
  circ_centrale_i: 0.25,
  circ_trappe: 0.90,
  circ_fermee: 0.0,
  // Attics (combles)
  comble_ventile: 1.0,
  comble_isole: 0.95,
  comble_non_isole: 0.85,
  // Crawl spaces (vide sanitaire)
  vide_ventile: 1.0,
  vide_isole: 0.65,
  vide_non_isole: 0.45,
  // Basements — garage
  ss_garage_R02_i: 0.80,
  ss_garage_R02_ni: 0.60,
  ss_garage_R0_i: 0.60,
  ss_garage_R0_ni: 0.40,
  // Basements — other
  ss_autre_R02_i: 0.75,
  ss_autre_R02_ni: 0.55,
  ss_autre_R0_i: 0.50,
  ss_autre_R0_ni: 0.30,
  // Tertiary / commercial spaces
  tertiaire_i_i: 0.30,
  tertiaire_i_ni: 0.50,
  tertiaire_ni_i: 0.40,
  tertiaire_ni_ni: 0.60,
  // Adjacent building
  batiment_adjacent: 0.90,
};

// ─── Correction factor tables for heating system (§2.9) ──────────────────────
export const CR_TABLE = {
  individuel: 0,
  central_tout_isole: 0.05,
  central_partiel: 0.10,
  central_non_isole: 0.20,
};
