/**
 * DTR C3.2 - Building Materials Thermal Resistance (R) & U-Values
 * Source: DTR C3.2 Annex B & C
 *
 * Exports:
 *   WALL_R_PRESETS     – wall presets  (R in m²K/W, without surface resistances)
 *   ROOF_R_PRESETS     – roof presets  (R in m²K/W, without surface resistances)
 *   FLOOR_R_PRESETS    – floor presets (R in m²K/W, without surface resistances)
 *   VITRAGE_OPTS       – glazing type options
 *   LAME_OPTS          – air-gap thickness options (for double glazing)
 *   CADRE_OPTS         – frame material options
 *   MATERIAU_OPTS      – door material options
 *   PROP_VITRAGE_OPTS  – glazed proportion options (for doors)
 *
 *   gKV(type, lame, cadre)          – returns U-value [W/m²K] for a window
 *   gKP(materiau, contact)          – returns U-value [W/m²K] for a door
 *
 * Shape: { label_fr, label_ar, R }
 *   R = null  →  "Manuel" (user enters rValue manually)
 *   R = number → thermal resistance of the construction layer only
 *                (surface resistances Rs_int/Rs_ext are added by the math engine)
 */

// ─────────────────────────────────────────────────────────────────────────────
// WALLS  (Murs) — R without surface resistances
// ─────────────────────────────────────────────────────────────────────────────
export const WALL_R_PRESETS = [
  { label_fr: "Manuel",                       label_ar: "يدوي",                              R: null },
  { label_fr: "Brique creuse 10cm",           label_ar: "طوب أجوف 10سم",                     R: 0.20 },
  { label_fr: "Brique creuse 15cm",           label_ar: "طوب أجوف 15سم",                     R: 0.29 },
  { label_fr: "Brique creuse 20cm",           label_ar: "طوب أجوف 20سم",                     R: 0.37 },
  { label_fr: "Brique creuse 25cm",           label_ar: "طوب أجوف 25سم",                     R: 0.46 },
  { label_fr: "Brique creuse 30cm",           label_ar: "طوب أجوف 30سم",                     R: 0.55 },
  { label_fr: "Brique pleine 10cm",           label_ar: "طوب مصمت 10سم",                     R: 0.13 },
  { label_fr: "Brique pleine 20cm",           label_ar: "طوب مصمت 20سم",                     R: 0.26 },
  { label_fr: "Parpaing creux 10cm",          label_ar: "بلوك أجوف 10سم",                    R: 0.16 },
  { label_fr: "Parpaing creux 15cm",          label_ar: "بلوك أجوف 15سم",                    R: 0.22 },
  { label_fr: "Parpaing creux 20cm",          label_ar: "بلوك أجوف 20سم",                    R: 0.27 },
  { label_fr: "Parpaing creux 25cm",          label_ar: "بلوك أجوف 25سم",                    R: 0.32 },
  { label_fr: "Parpaing plein 15cm",          label_ar: "بلوك مصمت 15سم",                    R: 0.10 },
  { label_fr: "Parpaing plein 20cm",          label_ar: "بلوك مصمت 20سم",                    R: 0.13 },
  { label_fr: "Double paroi brique 10+10 (lame d'air 4cm)", label_ar: "جدار مزدوج طوب 10+10 (فراغ 4سم)", R: 0.48 },
  { label_fr: "Double paroi brique 10+10 + laine de roche 4cm", label_ar: "طوب 10+10 + صوف صخري 4سم",   R: 1.45 },
  { label_fr: "Double paroi brique 10+15 (lame d'air 4cm)", label_ar: "جدار مزدوج طوب 10+15 (فراغ 4سم)", R: 0.57 },
  { label_fr: "Double paroi brique 15+15 (lame d'air 4cm)", label_ar: "جدار مزدوج طوب 15+15 (فراغ 4سم)", R: 0.66 },
  { label_fr: "Béton armé 15cm",              label_ar: "خرسانة مسلحة 15سم",                 R: 0.06 },
  { label_fr: "Béton armé 20cm",              label_ar: "خرسانة مسلحة 20سم",                 R: 0.08 },
  { label_fr: "Béton cellulaire 10cm",        label_ar: "خرسانة خلوية 10سم",                 R: 0.26 },
  { label_fr: "Béton cellulaire 15cm",        label_ar: "خرسانة خلوية 15سم",                 R: 0.39 },
  { label_fr: "Béton cellulaire 20cm",        label_ar: "خرسانة خلوية 20سم",                 R: 0.52 },
  { label_fr: "Laine de roche 4cm",           label_ar: "صوف صخري 4سم",                      R: 1.00 },
  { label_fr: "Laine de roche 6cm",           label_ar: "صوف صخري 6سم",                      R: 1.50 },
  { label_fr: "Laine de roche 8cm",           label_ar: "صوف صخري 8سم",                      R: 2.00 },
  { label_fr: "Polystyrène expansé 4cm",      label_ar: "بوليستيرين منتفخ 4سم",              R: 1.00 },
  { label_fr: "Polystyrène expansé 6cm",      label_ar: "بوليستيرين منتفخ 6سم",              R: 1.50 },
  { label_fr: "Polystyrène expansé 8cm",      label_ar: "بوليستيرين منتفخ 8سم",              R: 2.00 },
  { label_fr: "Polystyrène extrudé 4cm",      label_ar: "بوليستيرين مبثوق 4سم",              R: 1.25 },
  { label_fr: "Polystyrène extrudé 6cm",      label_ar: "بوليستيرين مبثوق 6سم",              R: 1.88 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROOFS  (Toitures) — R without surface resistances
// ─────────────────────────────────────────────────────────────────────────────
export const ROOF_R_PRESETS = [
  { label_fr: "Manuel",                              label_ar: "يدوي",                         R: null },
  { label_fr: "Dalle béton 15cm",                   label_ar: "بلاطة خرسانة 15سم",             R: 0.06 },
  { label_fr: "Dalle béton 20cm",                   label_ar: "بلاطة خرسانة 20سم",             R: 0.08 },
  { label_fr: "Dalle + enduit plâtre",               label_ar: "بلاطة + ليبج",                  R: 0.10 },
  { label_fr: "Dalle + laine de roche 4cm",          label_ar: "بلاطة + صوف صخري 4سم",          R: 1.08 },
  { label_fr: "Dalle + laine de roche 6cm",          label_ar: "بلاطة + صوف صخري 6سم",          R: 1.58 },
  { label_fr: "Dalle + laine de roche 8cm",          label_ar: "بلاطة + صوف صخري 8سم",          R: 2.08 },
  { label_fr: "Dalle + laine de roche 10cm",         label_ar: "بلاطة + صوف صخري 10سم",         R: 2.58 },
  { label_fr: "Dalle + polystyrène 4cm",             label_ar: "بلاطة + بوليستيرين 4سم",         R: 1.08 },
  { label_fr: "Dalle + polystyrène 6cm",             label_ar: "بلاطة + بوليستيرين 6سم",         R: 1.58 },
  { label_fr: "Dalle + polystyrène 8cm",             label_ar: "بلاطة + بوليستيرين 8سم",         R: 2.08 },
  { label_fr: "Dalle + polystyrène 10cm",            label_ar: "بلاطة + بوليستيرين 10سم",        R: 2.58 },
  { label_fr: "Dalle + polystyrène 12cm",            label_ar: "بلاطة + بوليستيرين 12سم",        R: 3.08 },
  { label_fr: "Toiture terrasse non isolée",         label_ar: "سطح مكشوف بدون عزل",             R: 0.15 },
  { label_fr: "Toiture terrasse + chape + laine 8cm",label_ar: "سطح + شابة + صوف 8سم",           R: 2.25 },
  { label_fr: "Comble non isolé",                    label_ar: "سقف علوي بدون عزل",              R: 0.10 },
  { label_fr: "Comble + laine minérale 10cm",        label_ar: "سقف علوي + صوف معدني 10سم",      R: 2.58 },
  { label_fr: "Comble + laine minérale 20cm",        label_ar: "سقف علوي + صوف معدني 20سم",      R: 5.13 },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOORS  (Planchers LNC) — R without surface resistances
// ─────────────────────────────────────────────────────────────────────────────
export const FLOOR_R_PRESETS = [
  { label_fr: "Manuel",                              label_ar: "يدوي",                         R: null },
  { label_fr: "Dalle béton 15cm",                   label_ar: "بلاطة خرسانة 15سم",             R: 0.06 },
  { label_fr: "Dalle béton 20cm",                   label_ar: "بلاطة خرسانة 20سم",             R: 0.08 },
  { label_fr: "Dalle + chape 5cm",                  label_ar: "بلاطة + طرطاج 5سم",             R: 0.10 },
  { label_fr: "Dalle + polystyrène 4cm + chape",    label_ar: "بلاطة + بوليستيرين 4سم + طرطاج", R: 1.08 },
  { label_fr: "Dalle + polystyrène 6cm + chape",    label_ar: "بلاطة + بوليستيرين 6سم + طرطاج", R: 1.58 },
  { label_fr: "Dalle + polystyrène 8cm + chape",    label_ar: "بلاطة + بوليستيرين 8سم + طرطاج", R: 2.08 },
  { label_fr: "Dalle + laine de roche 4cm + chape", label_ar: "بلاطة + صوف صخري 4سم + طرطاج",  R: 1.08 },
  { label_fr: "Dalle + laine de roche 6cm + chape", label_ar: "بلاطة + صوف صخري 6سم + طرطاج",  R: 1.58 },
  { label_fr: "Plancher bois 3cm",                  label_ar: "أرضية خشب 3سم",                 R: 0.20 },
  { label_fr: "Plancher bois 5cm",                  label_ar: "أرضية خشب 5سم",                 R: 0.33 },
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
