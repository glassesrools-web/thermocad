// src/utils/dtrCompute.js
import {
  TBE_ANCHORS, DREF_T, RS,
  KVN_T, KP_T,
  QVMIN, QVMAX_CUI, QVMAX_SDB, QVMAX_WC,
  PO_T, EV_T,
  KS52, KS53, KS58,
  TAU_AUTO,
  ROOM_THERMAL_DEFAULTS
} from "../constants/dtr.js";

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
export const f4 = v => +v.toFixed(4);
export const f2 = v => +v.toFixed(2);
export const n = v => parseFloat(v) || 0;
export const uid = () => Math.random().toString(36).slice(2, 7);

// ═══════════════════════════════════════════════════════════════════
// gTBE — calcul interpolé de la tbe
// ═══════════════════════════════════════════════════════════════════
export const gTBE = (zone, altitude) => {
  const actualZone = zone; // Bp و Dp موجودتان الآن مباشرة في TBE_ANCHORS
  const alt = Math.max(0, parseFloat(altitude) || 0);
  const anchors = TBE_ANCHORS[actualZone];
  if (!anchors) return null;
  if (alt <= anchors[0][0]) return anchors[0][1];
  if (alt >= anchors[anchors.length - 1][0]) {
    const [a1, t1] = anchors[anchors.length - 2];
    const [a2, t2] = anchors[anchors.length - 1];
    const grad = (t2 - t1) / (a2 - a1);
    return +((t2 + grad * (alt - a2)).toFixed(1));
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const [a1, t1] = anchors[i];
    const [a2, t2] = anchors[i + 1];
    if (alt >= a1 && alt <= a2) {
      const tbe = t1 + (t2 - t1) * (alt - a1) / (a2 - a1);
      return +(tbe.toFixed(1));
    }
  }
  return null;
};

export const gTBE_detail = (zone, altitude) => {
  const actualZone = zone;
  const alt = Math.max(0, parseFloat(altitude) || 0);
  const anchors = TBE_ANCHORS[actualZone];
  if (!anchors) return { tbe: null, band: null, interp: false };
  const tbe = gTBE(zone, altitude);
  let lower = null, upper = null;
  if (alt <= anchors[0][0]) {
    lower = upper = anchors[0];
  } else if (alt >= anchors[anchors.length - 1][0]) {
    lower = anchors[anchors.length - 2];
    upper = anchors[anchors.length - 1];
  } else {
    for (let i = 0; i < anchors.length - 1; i++) {
      if (alt >= anchors[i][0] && alt <= anchors[i + 1][0]) {
        lower = anchors[i]; upper = anchors[i + 1]; break;
      }
    }
  }
  const interp = lower && upper && lower[0] !== upper[0] && alt !== lower[0] && alt !== upper[0];
  return { tbe, lower, upper, interp, alt, zone: actualZone };
};

export const gKV = (type, lame, cadre) => { if (type === "simple") return KVN_T.simple[cadre] || 5.0; if (type === "dp30") return KVN_T.dp30[cadre] || 2.6; const k = lame <= 7 ? "d5" : lame <= 9 ? "d8" : lame <= 11 ? "d10" : "d12"; return KVN_T[k][cadre] || 2.9; };
export const gEV = (H, roughness) => {
  const e = EV_T[roughness] || EV_T.IV;
  if (H <= e[0][0]) return e[0][1];
  if (H >= e[e.length - 1][0]) return e[e.length - 1][1];
  for (let i = 0; i < e.length - 1; i++) {
    const [h0, v0] = e[i];
    const [h1, v1] = e[i + 1];
    if (H >= h0 && H <= h1) {
      return f4(v0 + (v1 - v0) * ((H - h0) / (h1 - h0)));
    }
  }
  return e[e.length - 1][1];
};
export const gKS = z => { for (const [lo, hi, ks] of KS52) if (z >= lo && z < hi) return ks; return 0; };
export const rCol53 = r => r < 0.40 ? 0 : r < 0.60 ? 1 : r < 0.80 ? 2 : r < 1.05 ? 3 : r < 1.55 ? 4 : r < 2.05 ? 5 : 6;
export const gKS53 = (z, r) => { for (const [lo, hi, ks] of KS53) if (z >= lo && z < hi) return ks[rCol53(r)]; return 0; };
export const gCorr54 = z => z <= -0.45 ? 0 : z < -0.20 ? 0.10 : 0.20;
export const gCorr55 = z => z <= -0.45 ? 0 : z < -0.20 ? 0.05 : 0.10;
export const gCorr56 = (z, r) => { const c = z <= -0.45 ? [0, 0, 0, 0] : z < -0.20 ? [0.05, 0.05, 0.10, 0.10] : [0.15, 0.15, 0.20, 0.25]; const ci = r < 0.40 ? 0 : r < 0.60 ? 1 : r < 1.05 ? 2 : 3; return c[ci]; };
export const gKSol = (z, type, r) => { if (!type || type === "sans_iso") return gKS(z); const base = gKS53(z, r); if (type === "iso_perimetre") return base; if (type === "iso_surface") return Math.max(0, f4(base - gCorr54(z))); if (type === "iso_peri_mur") return Math.max(0, f4(base - gCorr55(z))); if (type === "iso_surface_mur") return Math.max(0, f4(base - gCorr56(z, r))); return gKS(z); };
export const kCol58 = K => K < 0.50 ? 0 : K < 0.65 ? 1 : K < 0.80 ? 2 : K < 1.00 ? 3 : K < 1.20 ? 4 : K < 1.50 ? 5 : K < 1.80 ? 6 : K < 2.20 ? 7 : K < 2.60 ? 8 : K < 3.10 ? 9 : 10;
export const gKS58 = (z, K) => { if (z >= -0.20) return K; for (const [lo, hi, ks] of KS58) if (z >= lo && z < hi) return ks[kCol58(K)]; return 0; };
export const getTau = (obj, def = 0.65) => obj && obj.tau_mode === "auto" ? (TAU_AUTO[obj.type_lnc] ?? def) : (parseFloat(obj?.tau) || def);

// ═══════════════════════════════════════════════════════════════════
// COMPUTE FUNCTION — CORRECTED per official DTR
// ═══════════════════════════════════════════════════════════════════
export function compute(st) {
  const tbeDetail = gTBE_detail(st.zone, n(st.altitude));
  const tbe = tbeDetail.tbe;
  if (tbe === null) return { error: "Zone/altitude invalide" };
  const tbi = n(st.tbi) || 21;
  const dT = tbi - tbe;
  const Vh = n(st.Vh) || 100;
  // Bug 3 fix: nbPiecesRaw non-capped for Qvmin/Qvmax, np capped at 5 for table lookups only
  const nbPiecesRaw = Math.max(1, parseInt(st.nb_pieces) || 1);
  const np = Math.min(nbPiecesRaw, 5);
  let Ds = 0, Dlnc = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, S5 = 0;
  const warnings = [];
  const det = [];
  const det_lnc = [];
  // ─────────────────────────────────────────────────────────────────
  // 1. جدران خارجية
  // ─────────────────────────────────────────────────────────────────
  for (const p of (st.parois_ext || [])) {
    const A = n(p.surface), R = n(p.R);
    if (!A || !R) continue;
    const rs = RS[`${p.orientation || "lateral"}_ext`] || 0.17;
    const K = f4(1 / (rs + R));
    const ds = f4(K * A);
    Ds += ds;
    S3 += A;
    det.push({ nom: p.nom || "Mur extérieur", A, K, tau: "—", ds });
  }
  // ─────────────────────────────────────────────────────────────────
  // 2. جدران LNC
  // ─────────────────────────────────────────────────────────────────
  for (const p of (st.parois_lnc || [])) {
    const A = n(p.surface), R = n(p.R);
    if (!A || !R) continue;
    const tau = getTau(p, 0.5);
    const rs = RS[`${p.orientation || "lateral"}_lnc`] || 0.22;
    const K = f4(1 / (rs + R));
    const ds = f4(tau * K * A);
    Dlnc += ds;
    det_lnc.push({ nom: p.nom || "Mur LNC", A, K, tau, ds, type: "wall_lnc" });
  }
  // ─────────────────────────────────────────────────────────────────
  // 3. السقف (S1) — من الغرف
  // ─────────────────────────────────────────────────────────────────
  for (const tor of (st.toitures_rooms || [])) {
    const A = n(tor.surface);
    if (!A) continue;
    const contact = tor.contact || "ext";
    if (contact === "chauffe") {
      det.push({ nom: "Toiture (chauffée — non incluse dans Dref)", A, K: 0, ds: 0, tau: "—", note: "paroi intérieure" });
    } else {
      const R = n(tor.R);
      if (R > 0) {
        const rs = RS[`ascendant_${contact === "lnc" ? "lnc" : "ext"}`] || 0.14;
        const K = f4(1 / (rs + R));
        let tau = 1, ds = 0;
        if (contact === "lnc") {
          tau = getTau(tor, 0.9); ds = f4(tau * K * A);
          Dlnc += ds;
          S1 += A;
          det_lnc.push({ nom: `Toiture (sur LNC) — ${tor.roomName || ""}`, A, K, tau, ds, type: "roof_lnc" });
        } else {
          ds = f4(K * A);
          Ds += ds;
          S1 += A;
          det.push({ nom: `Toiture (extérieure) — ${tor.roomName || ""}`, A, K, tau: "—", ds });
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // 4. أرضية LNC — من الغرف
  // ─────────────────────────────────────────────────────────────────
  for (const rm of (st.planchers_lnc_rooms || [])) {
    const pl = rm.plancher || ROOM_THERMAL_DEFAULTS.plancher;
    const A = n(rm.area || 0);
    const R = n(pl.R);
    if (!A || !R) continue;
    const tau = getTau(pl, 0.65);
    const K = f4(1 / (RS.descendant_lnc + R));
    const ds = f4(tau * K * A);
    Dlnc += ds;
    S2 += A;
    det_lnc.push({ nom: `Plancher LNC — ${rm.name || rm.id}`, A, K, tau, ds, type: "floor_lnc" });
  }
  // ─────────────────────────────────────────────────────────────────
  // 5. أرضية مسخنة — من الغرف
  // ─────────────────────────────────────────────────────────────────
  for (const rm of (st.planchers_chauf_rooms || [])) {
    const A = n(rm.area || 0);
    if (!A) continue;
    det.push({ nom: `Plancher chauffé — ${rm.name || rm.id}`, A, K: 0, ds: 0, tau: "—", note: "paroi intérieure" });
  }
  // ─────────────────────────────────────────────────────────────────
  // 6. نوافذ (S5)
  // ─────────────────────────────────────────────────────────────────
  for (const f of (st.fenetres || [])) {
    const A = n(f.surface);
    if (!A) continue;
    let K;
    if (f.k_manuel && n(f.k_manuel) > 0) {
      K = f4(n(f.k_manuel));
    } else {
      K = gKV(f.type || "double", n(f.lame_mm) || 12, f.cadre || "bois");
    }
    if (f.contact === "lnc") {
      const tau = getTau(f, 0.5);
      const ds = f4(tau * K * A);
      Dlnc += ds;
      S5 += A;
      det_lnc.push({ nom: f.nom || "Fenêtre LNC", A, K, tau, ds, type: "window_lnc", k_manuel: f.k_manuel || "auto" });
    } else {
      const ds = f4(K * A);
      Ds += ds;
      S5 += A;
      det.push({ nom: f.nom || "Fenêtre", A, K, tau: "—", ds, k_manuel: f.k_manuel || "auto" });
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // 7. أبواب (S4)
  // ─────────────────────────────────────────────────────────────────
  for (const p of (st.portes || [])) {
    const A = n(p.surface);
    if (!A) continue;
    let K;
    if (p.k_manuel && n(p.k_manuel) > 0) {
      K = f4(n(p.k_manuel));
    } else {
      K = KP_T[`${p.materiau || "bois"}_${p.type_vitrage || "opaque"}_${p.contact || "ext"}`] || 3.5;
    }
    if (p.contact === "lnc") {
      const tau = getTau(p, 0.5);
      const ds = f4(tau * K * A);
      Dlnc += ds;
      S4 += A;
      det_lnc.push({ nom: p.nom || "Porte LNC", A, K, tau, ds, type: "door_lnc", k_manuel: p.k_manuel || "auto" });
    } else {
      const ds = f4(K * A);
      Ds += ds;
      S4 += A;
      det.push({ nom: p.nom || "Porte", A, K, tau: "—", ds, k_manuel: p.k_manuel || "auto" });
    }
  }
  Ds = f4(Ds);
  Dlnc = f4(Dlnc);
  // ─────────────────────────────────────────────────────────────────
  // 8. الجسور الحرارية Dli = 20% من Ds فقط
  // ─────────────────────────────────────────────────────────────────
  const Dli = f4(0.20 * Ds);
  // ─────────────────────────────────────────────────────────────────
  // 9. فقدان التربة Dsol
  // ─────────────────────────────────────────────────────────────────
  let Dsol = 0;
  const det_sol = [];
  for (const rm of (st.planchers_sol_rooms || [])) {
    const pl = rm.plancher || {};
    const autoPerim = rm.points && rm.points.length > 1
      ? parseFloat((rm.points.reduce((s, p, i) => {
          const nx = rm.points[(i + 1) % rm.points.length];
          return s + Math.hypot(nx.x - p.x, nx.y - p.y);
        }, 0) / 50).toFixed(2))
      : 0;
    const perim = n(pl.perimetre) || autoPerim;
    const zs = parseFloat(pl.z) || 0;
    const A = n(rm.area || 0);
    if (!perim || zs === undefined) continue;
    const typeIso = pl.type_iso || "sans_iso";
    const rIso = n(pl.r_iso) || 1.0;
    const ks = f4(gKSol(zs, typeIso, rIso));
    const ds_sol = f4(ks * perim);
    Dsol += ds_sol;
    if (A > 0) S2 += A;
    det_sol.push({ nom: `Plancher/Sol — ${rm.name || rm.id}`, ks, p: perim, surface: A, ds: ds_sol, type: typeIso });
  }
  for (const m of (st.murs_enterres || [])) {
    const p_m = n(m.perimetre), R_m = n(m.R), z_m = parseFloat(m.z) || 0;
    if (!p_m || !R_m) continue;
    const K_m = f4(1 / (RS.lateral_ext + R_m));
    const ks_m = f4(gKS58(z_m, K_m));
    const ds_m = f4(ks_m * p_m);
    Dsol += ds_m;
    det_sol.push({ nom: m.nom || "Mur enterré", ks: ks_m, K: K_m, p: p_m, ds: ds_m, type: "mur_enterre" });
  }
  Dsol = f4(Dsol);
  // ─────────────────────────────────────────────────────────────────
  // 10. DT الكلي
  // ─────────────────────────────────────────────────────────────────
  const DT = f4(Ds + Dli + Dlnc + Dsol);
  // ─────────────────────────────────────────────────────────────────
  // 11. Dref
  // ─────────────────────────────────────────────────────────────────
  const cf = (DREF_T[st.type_log] || DREF_T.collectif)[st.zone] || [1, 2.4, 1.2, 3.5, 4.5];
  const Dref = f4(cf[0] * S1 + cf[1] * S2 + cf[2] * S3 + cf[3] * S4 + cf[4] * S5);
  const reg_ok = DT <= +(1.05 * Dref).toFixed(4);
  // ─────────────────────────────────────────────────────────────────
  // 12. تجديد الهواء Qv
  // ─────────────────────────────────────────────────────────────────
  const nsdb = parseInt(st.nb_sdb) || 1;
  const nae = parseInt(st.nb_autre_eau) || 0;
  const nwc = parseInt(st.nb_wc) || 1;
  // Bug 3 fix: Qvmin expands linearly above 5 rooms per DTR §7.2
  const Qvmin_v = nbPiecesRaw <= 5
    ? (QVMIN[nbPiecesRaw] || 25 * nbPiecesRaw)
    : 110 + (nbPiecesRaw - 5) * 10;
  // Bug 3 fix: Qvmax cuisine also expands above 5 rooms
  const cuisineMax = nbPiecesRaw <= 5
    ? (QVMAX_CUI[nbPiecesRaw] || 135)
    : 135 + (nbPiecesRaw - 5) * 15;
  const Qvmax_v = cuisineMax + (QVMAX_SDB[np] || 30) * nsdb + 15 * nae + (QVMAX_WC[np] || 30) * nwc;
  const Qvref = f2((5 * Qvmin_v + Qvmax_v) / 6);
  const Qv = f2(Math.max(0.6 * Vh, Qvref));
  // ─────────────────────────────────────────────────────────────────
  // 13. تسرب الريح Qs
  // DTR §7.3: Qs = (Σ Po_j × A_j) × √EV / 2
  // Group by roughness+height so √EV is applied correctly per group.
  // ─────────────────────────────────────────────────────────────────
  let Qs = 0;
  const evGroups = new Map();
  for (const o of (st.ouvrants_vent || [])) {
    const A = n(o.surface);
    if (!A) continue;
    const po  = PO_T[o.type] || 4.0;
    const H   = n(o.H) || 4;
    const rug = o.rugosite || "IV";
    const key = `${rug}|${H}`;
    if (!evGroups.has(key)) evGroups.set(key, { po_A: 0, H, rug });
    evGroups.get(key).po_A += po * A;
  }
  for (const { po_A, H, rug } of evGroups.values()) {
    Qs += po_A * Math.sqrt(gEV(H, rug));
  }
  Qs = f2(Qs / 2); // ÷2 per DTR §7.3
  const DR = f4(0.34 * (Qv + Qs));
  const DRv = f4(0.34 * Qv);
  const DRs = f4(0.34 * Qs);
  // ─────────────────────────────────────────────────────────────────
  // 14. معاملات التصحيح cr و cin
  // ─────────────────────────────────────────────────────────────────
  const CR = { individuel: 0, central_tout_isole: 0.05, central_partiel: 0.10, central_non_isole: 0.20 };
  const cr = CR[st.type_chauf] ?? 0.10;
  // DTR §2.9: cin applies ONLY to discontinuous heating.
  // Continuous heating → cin = 0 (no intermittency surcharge).
  let cin = 0;
  if (st.mode_chauf === "discontinu") {
    if (st.inertie === "forte") cin = 0.20;
    else cin = 0.15;
  }
  // ─────────────────────────────────────────────────────────────────
  // 15. الاستطاعة الحرارية النهائية Q
  // ─────────────────────────────────────────────────────────────────
  const Q = +((tbi - tbe) * ((1 + Math.max(cr, cin)) * DT + (1 + cr) * DR)).toFixed(1);
  const DB = +((DT + DR) * dT).toFixed(1);
  // ─────────────────────────────────────────────────────────────────
  // 17. توزيع الاستطاعة على الغرف — §II.5.3 DTR
  // ─────────────────────────────────────────────────────────────────
  const rooms_list = st.rooms_list || [];
  let rooms_q = [];
  if (rooms_list.length > 0 && Q > 0) {
    const totalVol = rooms_list.reduce((s, r) => s + r.volume, 0);
    if (totalVol > 0) {
      rooms_q = rooms_list.map(r => {
        const pct = f2((r.volume / totalVol) * 100);
        const qRoom = Math.round(Q * r.volume / totalVol);
        return { id: r.id, name: r.name, volume: r.volume, area: r.area, pct, Q: qRoom, Qkw: +(qRoom / 1000).toFixed(3) };
      }).sort((a, b) => b.Q - a.Q);
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // 16. النتائج + تحذيرات (Bug 8)
  // ─────────────────────────────────────────────────────────────────
  if (Ds === 0 && (st.parois_ext || []).length > 0)
    warnings.push("⚠️ Ds = 0 : toutes les surfaces ext. sont nulles — vérifier les ouvertures");
  if (DT === 0)
    warnings.push("⚠️ DT = 0 : aucune déperdition calculée — vérifier les données géométriques");
  if (Qv < Qvmin_v)
    warnings.push(`⚠️ Qv (${Qv}) < Qvmin (${Qvmin_v}) m³/h — augmenter Vh ou nb de pièces`);
  return {
    tbe, tbi, dT: f2(dT),
    det, det_lnc, det_sol,
    Ds, Dli, Dsol, Dlnc, DT, Dref, reg_ok,
    Qv, Qvref, Qvmin: Qvmin_v, Qvmax: Qvmax_v,
    Qs, DR, DRv, DRs,
    cr, cin,
    Q, Qkw: +(Q / 1000).toFixed(3), DB,
    S1, S2, S3, S4, S5,
    rooms_q,
    tbeDetail,
    warnings
  };
}
