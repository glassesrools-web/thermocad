/**
 * DTR C3.2 - Algerian Climate Data
 * Source: DTR C3.2, Pages 152-156
 * Complete database of Wilayas mapped to thermal zones, with commune-level exceptions.
 */

export const CLIMATE_ZONES = {
  A:  { name: "Zone A (Littoral / Côtier)" },
  B:  { name: "Zone B (Tell / Intérieur Nord)" },
  C:  { name: "Zone C (Hauts Plateaux)" },
  D:  { name: "Zone D (Pré-Saharien)" },
  E:  { name: "Zone E (Saharien)" },
  E1: { name: "Zone E1 (Grand Sud / Extrême Saharien)" },
};

/**
 * Each Wilaya object:
 *   id          – official wilaya number
 *   name        – wilaya name
 *   defaultZone – zone applied to any commune NOT listed in `communes`
 *   communes    – array of { name, zone }.
 *                 The last entry is always the catch-all fallback.
 */
export const WILAYAS = [
  {
    id: 1,
    name: "Adrar",
    defaultZone: "D",
    communes: [
      { name: "Tinerkouk",           zone: "C" },
      { name: "Bordj Badji Mokhtar", zone: "C" },
      { name: "Toutes les autres communes", zone: "D" },
    ],
  },
  {
    id: 2,
    name: "Chlef",
    defaultZone: "A",
    communes: [
      { name: "Toutes les autres communes", zone: "A" },
    ],
  },
  {
    id: 3,
    name: "Laghouat",
    defaultZone: "B",
    communes: [
      { name: "Sidi Makhlouf",  zone: "C" },
      { name: "El Assafia",     zone: "C" },
      { name: "Laghouat",       zone: "C" },
      { name: "Ain Madhi",      zone: "C" },
      { name: "Ksar El Hirane", zone: "C" },
      { name: "Mekhareg",       zone: "C" },
      { name: "Kheneg",         zone: "C" },
      { name: "Hassi Dhelaa",   zone: "C" },
      { name: "El Haouaita",    zone: "C" },
      { name: "Hassi Rmel",     zone: "C" },
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 4,
    name: "Oum El Bouaghi",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 5,
    name: "Batna",
    defaultZone: "B",
    communes: [
      { name: "Metkaouak",   zone: "C" },
      { name: "Ouled Ammar", zone: "C" },
      { name: "Barika",      zone: "C" },
      { name: "Tilatou",     zone: "C" },
      { name: "Seggana",     zone: "C" },
      { name: "Bitam",       zone: "C" },
      { name: "Mdoukal",     zone: "C" },
      { name: "Tigharghar",  zone: "C" },
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 6,
    name: "Béjaïa",
    defaultZone: "A",
    communes: [
      { name: "Toutes les autres communes", zone: "A" },
    ],
  },
  {
    id: 7,
    name: "Biskra",
    defaultZone: "E",
    communes: [
      { name: "El Kantara",           zone: "A" },
      { name: "Ain Zaatout",          zone: "A" },
      { name: "Djemorah",             zone: "A" },
      { name: "Branis",               zone: "A" },
      { name: "Chetma",               zone: "A" },
      { name: "Khangat Sidi Nadji",   zone: "A" },
      { name: "Zeribet El Oued",      zone: "A" },
      { name: "El Feidh",             zone: "A" },
      { name: "Toutes les autres communes", zone: "E" },
    ],
  },
  {
    id: 8,
    name: "Béchar",
    defaultZone: "D",
    communes: [
      { name: "Beni Ounif", zone: "E" },
      { name: "Mougheul",   zone: "E" },
      { name: "Boukais",    zone: "E" },
      { name: "Bechar",     zone: "E" },
      { name: "Lahmar",     zone: "E" },
      { name: "Kenadsa",    zone: "E" },
      { name: "Meridja",    zone: "E" },
      { name: "Taghit",     zone: "E" },
      { name: "Erg Ferradj",zone: "E" },
      { name: "Abadla",     zone: "E" },
      { name: "Toutes les autres communes", zone: "D" },
    ],
  },
  {
    id: 9,
    name: "Blida",
    defaultZone: "A",
    communes: [
      { name: "Toutes les autres communes", zone: "A" },
    ],
  },
  {
    id: 10,
    name: "Bouira",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 11,
    name: "Tamanrasset",
    defaultZone: "E",
    communes: [
      { name: "Tazrouk",     zone: "E1" },
      { name: "Tamanrasset", zone: "E1" },
      { name: "Toutes les autres communes", zone: "E" },
    ],
  },
  {
    id: 12,
    name: "Tébessa",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 13,
    name: "Tlemcen",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 14,
    name: "Tiaret",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 15,
    name: "Tizi Ouzou",
    defaultZone: "A",
    communes: [
      { name: "Toutes les autres communes", zone: "A" },
    ],
  },
  {
    id: 16,
    name: "Alger",
    defaultZone: "A",
    communes: [
      { name: "Toutes les autres communes", zone: "A" },
    ],
  },
  {
    id: 17,
    name: "Djelfa",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 18,
    name: "Jijel",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 19,
    name: "Sétif",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 20,
    name: "Saïda",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 21,
    name: "Skikda",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 22,
    name: "Sidi Bel Abbès",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 23,
    name: "Annaba",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 24,
    name: "Guelma",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 25,
    name: "Constantine",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 26,
    name: "Médéa",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 27,
    name: "Mostaganem",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 28,
    name: "M'Sila",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 29,
    name: "Mascara",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 30,
    name: "Ouargla",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 31,
    name: "Oran",
    defaultZone: "A",
    communes: [
      { name: "Toutes les autres communes", zone: "A" },
    ],
  },
  {
    id: 32,
    name: "El Bayadh",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 33,
    name: "Illizi",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 34,
    name: "Bordj Bou Arreridj",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 35,
    name: "Boumerdès",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 36,
    name: "El Tarf",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 37,
    name: "Tindouf",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 38,
    name: "Tissemsilt",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 39,
    name: "El Oued",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 40,
    name: "Khenchela",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 41,
    name: "Souk Ahras",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 42,
    name: "Tipaza",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 43,
    name: "Mila",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 44,
    name: "Aïn Defla",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 45,
    name: "Naâma",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 46,
    name: "Aïn Témouchent",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 47,
    name: "Ghardaïa",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
  {
    id: 48,
    name: "Relizane",
    defaultZone: "B",
    communes: [
      { name: "Toutes les autres communes", zone: "B" },
    ],
  },
];
