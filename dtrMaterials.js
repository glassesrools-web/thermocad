/**
 * DTR C3.2 - Building Materials U-Values
 * Source: DTR Annex B & C — U-Values in W/m²K
 *
 * Exports:
 *   PRESETS_MURS       – wall presets
 *   PRESETS_TOITURES   – roof presets
 *   PRESETS_PLANCHERS  – floor presets
 *   VITRAGE_OPTS       – glazing type options
 *   LAME_OPTS          – air-gap thickness options (for double glazing)
 *   CADRE_OPTS         – frame material options
 *   MATERIAU_OPTS      – door material options
 *   PROP_VITRAGE_OPTS  – glazed proportion options (for doors)
 *
 *   gKV(type, lame, cadre)         – returns U-value [W/m²K] for a window
 *   gKP(materiau, vitrage, contact) – returns U-value [W/m²K] for a door
 */

// ─────────────────────────────────────────────────────────────────────────────
// WALLS  (Murs)
// ─────────────────────────────────────────────────────────────────────────────
export const PRESETS_MURS = [
  { val: "db_brique_10_air_10",    label: "Double paroi brique (10+air+10)",       u: 1.28 },
  { val: "db_brique_isolant_5cm",  label: "Double brique + Isolant 5cm",           u: 0.66 },
  { val: "brique_creuse_10cm",     label: "Mur simple brique creuse (10cm)",       u: 2.38 },
  { val: "terre_11cm",             label: "Mur briquettes de terre (11cm)",        u: 3.25 },
  { val: "terre_22cm",             label: "Mur briquettes de terre (22cm)",        u: 2.20 },
  { val: "parpaings_15cm",         label: "Mur parpaings creux (15cm)",            u: 2.65 },
  { val: "parpaings_20cm",         label: "Mur parpaings creux (20cm)",            u: 2.43 },
  { val: "beton_arme_15cm",        label: "Voile en Béton Armé (15cm)",            u: 1.41 },
  { val: "beton_arme_20cm",        label: "Voile en Béton Armé (20cm)",            u: 1.18 },
  { val: "manuel",                 label: "Personnalisé (Saisie Manuelle U)",      u: ""   },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROOFS  (Toitures)
// ─────────────────────────────────────────────────────────────────────────────
export const PRESETS_TOITURES = [
  { val: "terrasse_isol_5cm",      label: "Toiture Terrasse Isolée (5cm)",         u: 0.65 },
  { val: "terrasse_isol_8cm",      label: "Toiture Terrasse Isolée (8cm)",         u: 0.48 },
  { val: "dalle_beton_20cm",       label: "Dalle Pleine Béton (20cm) non isolée",  u: 3.57 },
  { val: "tuiles_sans_solivage",   label: "Tuiles/Fibrociment sans solivage",      u: 5.80 },
  { val: "tuiles_avec_solivage",   label: "Tuiles/Fibrociment avec solivage",      u: 4.06 },
  { val: "tole_sans_solivage",     label: "Tôle galvanisée sans solivage",         u: 9.28 },
  { val: "tole_avec_solivage",     label: "Tôle galvanisée avec solivage",         u: 4.64 },
  { val: "manuel",                 label: "Personnalisé (Saisie Manuelle U)",      u: ""   },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOORS  (Planchers)
// ─────────────────────────────────────────────────────────────────────────────
export const PRESETS_PLANCHERS = [
  { val: "dalle_pleine_15cm",      label: "Dalle Pleine Béton (15cm)",             u: 2.70 },
  { val: "corps_creux_16_4",       label: "Plancher Corps Creux (16+4)",           u: 2.05 },
  { val: "corps_creux_20_4",       label: "Plancher Corps Creux (20+4)",           u: 1.80 },
  { val: "manuel",                 label: "Personnalisé (Saisie Manuelle U)",      u: ""   },
];

// ─────────────────────────────────────────────────────────────────────────────
// WINDOWS — component option lists
// ─────────────────────────────────────────────────────────────────────────────

/** Glazing type */
export const VITRAGE_OPTS = [
  { val: "simple",  label: "Vitrage Simple" },
  { val: "double",  label: "Double Vitrage" },
  { val: "manuel",  label: "Personnalisé (Saisie Manuelle U)", u: "" },
];

/** Air-gap thickness — only relevant for double glazing */
export const LAME_OPTS = [
  { val: "lte7",   label: "Lame d'air ≤ 7mm" },
  { val: "8_9",    label: "Lame d'air 8–9mm" },
  { val: "10_11",  label: "Lame d'air 10–11mm" },
  { val: "12_13",  label: "Lame d'air 12–13mm" },
  { val: "gt30",   label: "Lame d'air > 30mm" },
  { val: "manuel", label: "Personnalisé (Saisie Manuelle U)", u: "" },
];

/** Frame material */
export const CADRE_OPTS = [
  { val: "bois_pvc", label: "Bois / PVC" },
  { val: "metal",    label: "Métal" },
  { val: "manuel",   label: "Personnalisé (Saisie Manuelle U)", u: "" },
];

// ─────────────────────────────────────────────────────────────────────────────
// DOORS — component option lists
// ─────────────────────────────────────────────────────────────────────────────

/** Door material / type */
export const MATERIAU_OPTS = [
  { val: "metal",          label: "Métal" },
  { val: "bois_2_5cm",     label: "Bois 2.5cm" },
  { val: "bois_3_2cm",     label: "Bois 3.2cm" },
  { val: "bois_3_8cm",     label: "Bois 3.8cm" },
  { val: "bois_4_4cm",     label: "Bois 4.4cm" },
  { val: "vitree_lt30",    label: "Porte Vitrée (< 30% vitrage)" },
  { val: "vitree_30_60",   label: "Porte Vitrée (30–60% vitrage)" },
  { val: "opaque",         label: "Porte Opaque" },
  { val: "manuel",         label: "Personnalisé (Saisie Manuelle U)", u: "" },
];

/** Glazed proportion — used for vitrée & opaque doors to select contact type */
export const PROP_VITRAGE_OPTS = [
  { val: "exterieur", label: "Contact Extérieur" },
  { val: "lnc",       label: "Contact Local Non Chauffé (LNC)" },
  { val: "manuel",    label: "Personnalisé (Saisie Manuelle U)", u: "" },
];

// ─────────────────────────────────────────────────────────────────────────────
// U-VALUE LOOKUP — WINDOWS
// gKV(type, lame, cadre) → U in W/m²K, or "" if manual
//
//   type  : "simple" | "double" | "manuel"
//   lame  : "lte7" | "8_9" | "10_11" | "12_13" | "gt30"  (double only)
//   cadre : "bois_pvc" | "metal"
// ─────────────────────────────────────────────────────────────────────────────
export function gKV(type, lame, cadre) {
  if (type === "manuel" || cadre === "manuel" || lame === "manuel") return "";

  if (type === "simple") {
    return cadre === "metal" ? 5.8 : 5.0;
  }

  if (type === "double") {
    // U values keyed by [lame][cadre]
    const table = {
      lte7:  { bois_pvc: 3.3, metal: 4.0 },
      "8_9": { bois_pvc: 3.1, metal: 3.9 },
      "10_11":{ bois_pvc: 3.0, metal: 3.8 },
      "12_13":{ bois_pvc: 2.9, metal: 3.7 },
      gt30:  { bois_pvc: 2.6, metal: 3.0 },
    };
    const row = table[lame];
    if (!row) return "";
    return row[cadre] !== undefined ? row[cadre] : "";
  }

  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// U-VALUE LOOKUP — DOORS
// gKP(materiau, contact) → U in W/m²K, or "" if manual
//
//   materiau : "metal" | "bois_2_5cm" | "bois_3_2cm" | "bois_3_8cm" |
//              "bois_4_4cm" | "vitree_lt30" | "vitree_30_60" | "opaque" | "manuel"
//   contact  : "exterieur" | "lnc"
// ─────────────────────────────────────────────────────────────────────────────
export function gKP(materiau, contact) {
  if (materiau === "manuel" || contact === "manuel") return "";

  const table = {
    // Métal
    metal:        { exterieur: 5.8, lnc: 4.5 },

    // Bois (thickness variants — contact has no effect, single U value)
    bois_2_5cm:   { exterieur: 3.94, lnc: 3.94 },
    bois_3_2cm:   { exterieur: 3.36, lnc: 3.36 },
    bois_3_8cm:   { exterieur: 3.00, lnc: 3.00 },
    bois_4_4cm:   { exterieur: 2.90, lnc: 2.90 },

    // Portes vitrées
    vitree_lt30:  { exterieur: 4.0, lnc: 2.4 },
    vitree_30_60: { exterieur: 4.5, lnc: 2.7 },

    // Portes opaques
    opaque:       { exterieur: 3.5, lnc: 2.0 },
  };

  const row = table[materiau];
  if (!row) return "";
  return row[contact] !== undefined ? row[contact] : "";
}


// ─────────────────────────────────────────────────────────────────────────────
// INSULATION MATERIALS  (Isolants)
// DTR C3.2 typical lambda values (W/m·K)
// ─────────────────────────────────────────────────────────────────────────────
export const ISOLANT_OPTS = [
  { val: "aucun",                label: "Aucun isolant",                        lambda: null  },
  { val: "polystyrene_expanse",  label: "Polystyrène expansé (PSE)",            lambda: 0.038 },
  { val: "laine_de_roche",       label: "Laine de roche",                       lambda: 0.038 },
  { val: "laine_de_verre",       label: "Laine de verre",                       lambda: 0.040 },
  { val: "liege",                label: "Liège",                                lambda: 0.040 },
  { val: "polyurethane",         label: "Mousse de Polyuréthane (PUR)",         lambda: 0.025 },
];
