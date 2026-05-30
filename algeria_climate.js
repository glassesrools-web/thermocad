/**
 * DTR 101330 — Algerian Climate Data
 * Complete 48-wilaya database with exact "Groupe de communes" from the official table.
 * Pages 154-156 of the DTR C3.2 / DTR 101330 document.
 *
 * Zone keys: A1 | A | B | C | D
 */

export const CLIMATE_ZONES = {
  A1: { name: "Zone A1 (Littoral exposé)" },
  A:  { name: "Zone A (Littoral / Côtier)" },
  B:  { name: "Zone B (Tell / Intérieur Nord)" },
  C:  { name: "Zone C (Hauts Plateaux)" },
  D:  { name: "Zone D (Saharien)" },
};

/**
 * Each Wilaya:
 *   id          – official wilaya number
 *   name        – wilaya name
 *   defaultZone – zone applied when the user picks "Toutes les autres communes"
 *   communes    – ordered list matching the DTR table groups.
 *                 The LAST entry is always the catch-all "Toutes les autres communes".
 */
export const WILAYAS = [
  {
    id: 1,
    name: "Adrar",
    defaultZone: "D",
    communes: [
      {
        name: "Groupe 1 : TINERKOUK, BORDJ BADJI MOKHTAR",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "D",
      },
    ],
  },
  {
    id: 2,
    name: "Chlef",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : TENES, OUED GHOUSSINE, SIDI ABDERRAHMANE, SIDI AKKACHA",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 3,
    name: "Laghouat",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : SIDI MAKHLOUF, EL ASSAFIA, LAGHOUAT, AIN MADHI, KSAR EL HIRANE, MEKHAREG, KHENEG, HASSI DHELAA, EL HAOUAITA, HASSI RMEL",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 4,
    name: "Oum El Bouaghi",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "B",
      },
    ],
  },
  {
    id: 5,
    name: "Batna",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : METKAOUAK, OULED AMMAR, BARIKA, TILATOU, SEGGANA, BITAM, MDOUKAL, TIGHARGHAR",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 6,
    name: "Béjaïa",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : BENI KSILA, TOUDJA, BEJAIA, EL KSEUR, TAOURIRT IGHIL, OUED GHIR, TALA HAMZA",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 7,
    name: "Biskra",
    defaultZone: "C",
    communes: [
      {
        name: "Groupe 1 : KHANGAT SIDI NADJI",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "C",
      },
    ],
  },
  {
    id: 8,
    name: "Béchar",
    defaultZone: "D",
    communes: [
      {
        name: "Groupe 1 : BENI OUNIF, MOUGHEUL, BOUKAIS, BECHAR, LAHMAR, KENADSA, MERIDJA, TAGHIT, ERG FERRADJ, ABADLA",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "D",
      },
    ],
  },
  {
    id: 9,
    name: "Blida",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 10,
    name: "Bouira",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : MEZDOUR, BORDJ OUKHRISS, RIDANE, DIRAH, MAAMORA, TAGUEDIT, HADJERA ZERGA",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 11,
    name: "Tamanrasset",
    defaultZone: "D",
    communes: [
      {
        name: "Groupe 1 : TAZROUK, TAMANRASSET, ABALESSA, TIN ZAOUATINE, IN GUEZZAM",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "D",
      },
    ],
  },
  {
    id: 12,
    name: "Tébessa",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : FERKANE, NEGRINE",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 13,
    name: "Tlemcen",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : AIN TALLOUT, OULED MIMOUN, OUED CHOULY, BENI SEMIEL, TERNI BENI HEDIEL, AIN GHORABA, BENI BOUSSAID, BENI BAHDEL, BENI SNOUS, SEBDOU, AZAILS, EL GOR, SIDI DJILLALI, EL ARICHA, EL BOUIHI",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 14,
    name: "Tiaret",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "B",
      },
    ],
  },
  {
    id: 15,
    name: "Tizi Ouzou",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : MIZRANA",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 16,
    name: "Alger",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 17,
    name: "Djelfa",
    defaultZone: "C",
    communes: [
      {
        name: "Groupe 1 : BENHAR, AIN OUESSARA, BIRINE, AIN FEKKA, EL KHEMIS, HASSI FDOUL, HAD SAHARY, SIDI LAADJEL, BOUIRA LAHDAB, GUERNINI, HASSI EL EUCH, HASSI BAHBAH, ZAAFRANE, EL GUEDDID, CHAREF, BENI YAGOUB, EL IDRISSIA, DOUIS, AIN CHOUHADA",
        zone: "B",
      },
      {
        name: "Groupe 2 : OUM LAADHAM, GUETTARA",
        zone: "D",
      },
      {
        name: "Groupe 3 : Toutes les autres communes",
        zone: "C",
      },
    ],
  },
  {
    id: 18,
    name: "Jijel",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 19,
    name: "Sétif",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : BABOR, AIT TIZI, MZADA, AIN SEBT, SERDJ EL GHOUL, OUED EL BARED, BENI MOUHLI, BOUANDAS, BENI AZIZ, BOUSSELAM, BENI CHEBANA, TALA IFACENE, BENI OUARTILANE, TIZI NBECHAR, DRAA KEBILA, AIN LAGRADJ, MAOUKLANE, MAAOUIA, DEHAMCHA, AMOUCHA, AIN EL KEBIRA, DJEMILA, HAMMAM GUERGOUR, AIN ROUA, HARBIL, AIN ABESSA, BOUGAA, GUENZET TASSAMEURT, OULED ADDOUANE, BENI FOUDA, EL OURICIA, BENI HOCINE, TACHOUDA",
        zone: "A",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 20,
    name: "Saïda",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "B",
      },
    ],
  },
  {
    id: 21,
    name: "Skikda",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : AIN ZOUIT, FIL FILA, SKIKDA, HAMMADI KROUMA, EL HADAIEK",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 22,
    name: "Sidi Bel Abbès",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : MAKEDRA, AIN EL BERD, BOUDJEBAA EL BORDJ, AIN ADDEN, AIN THRID, SIDI HAMADOUCHE, TESSALA, ZEROUALA, SFISEF, SIDI BRAHIM, SEHALA THAOURA, SIDI LAHCENE, SIDI BEL ABBES, MOSTEFA BEN BRAHIM, TILMOUNI, SIDI DAHO, SIDI YACOUB, AIN KADA, BELARBI, AMARNAS, SIDI KHALED, SIDI ALI BOUSSIDI, BOUKANEFIS, LAMTAR, HASSI ZAHANA, BEDRABINE EL MOKRANI",
        zone: "A",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 23,
    name: "Annaba",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 24,
    name: "Guelma",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : HAMMAM NBAIL, OUED CHEHAM, KHEZARA, OUED ZENATI, DAHOUARA, AIN LARBI, AIN REGGADA, BOUHACHANA, AIN SANDEL, AIN MAKHLOUF, TAMLOUKA",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 25,
    name: "Constantine",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : EL KHROUB, AIN SMARA, AIN ABID, OULED RAHMOUN",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 26,
    name: "Médéa",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "B",
      },
    ],
  },
  {
    id: 27,
    name: "Mostaganem",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 28,
    name: "M'Sila",
    defaultZone: "C",
    communes: [
      {
        name: "Groupe 1 : HAMMAM DHALAA, BENI ILMENE, OUENOUGHA, SIDI AISSA, TARMOUNT, MAADID, BOUTI SAYEH, OULED ADDI GUEBALA, DEHAHNA, MAGRA, BERHOUM, BELAIBA",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "C",
      },
    ],
  },
  {
    id: 29,
    name: "Mascara",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : MOCTADOUZ, EL GHOMRI, SIDI ABDELMOUMENE, ALAIMIA, RAS EL AIN AMIROUCHE, SEDJERARA, MOHAMMADIA, OGGAZ, BOUHENNI, EL MENAOUER, SIG, ZAHANA, EL BORDJ, AIN FARES, HACINE, EL MAMOUNIA, FERRAGUIG, SIDI ABDELDJABAR, SEHAILIA, CHORFA, EL GAADA, KHALOUIA, EL GUEITNA, TIGHENNIF, MAOUSSA, MASCARA, EL KEURT, TIZI, BOUHANIFIA",
        zone: "A",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 30,
    name: "Ouargla",
    defaultZone: "D",
    communes: [
      {
        name: "Groupe 1 : EL BORMA",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "D",
      },
    ],
  },
  {
    id: 31,
    name: "Oran",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 32,
    name: "El Bayadh",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : BREZINA, EL ABIODH SIDI CHEIKH, EL BNOUD",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 33,
    name: "Illizi",
    defaultZone: "C",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "C",
      },
    ],
  },
  {
    id: 34,
    name: "Bordj Bou Arreridj",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : EL MAIN, DJAAFRA, TAFREG, KHELIL, TESMART, BORDJ ZEMOURA, COLLA, OULED SIDI BRAHIM, OULED DAHMANE, THENIET EL ANSEUR, HARAZA",
        zone: "A",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 35,
    name: "Boumerdès",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : DELLYS, SIDI DAOUD, AFIR, BEN CHOUD, BAGHLIA, OULED AISSA, TAOURGA",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 36,
    name: "El Tarf",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : EL KALA, BERRIHANE",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 37,
    name: "Tindouf",
    defaultZone: "D",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "D",
      },
    ],
  },
  {
    id: 38,
    name: "Tissemsilt",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : LAZHARIA, LARBAA, BOUCAID, BORDJ BOUNAAMA",
        zone: "A",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 39,
    name: "El Oued",
    defaultZone: "C",
    communes: [
      {
        name: "Groupe 1 : OUM TIOUR, EL MGHAIR, SIDI KHELLIL, TENDLA, MRARA, DJAMAA, SIDI AMRANE",
        zone: "D",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "C",
      },
    ],
  },
  {
    id: 40,
    name: "Khenchela",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : BABAR",
        zone: "C",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 41,
    name: "Souk Ahras",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe 1 : MECHROHA, AIN ZANA, OULED DRISS",
        zone: "A",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "B",
      },
    ],
  },
  {
    id: 42,
    name: "Tipaza",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 43,
    name: "Mila",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : OUED ATHMANIA, BENYAHIA ABDERRAHMANE, OUED SEGUEN, CHELGHOUM LAID, TADJENANET, TELAGHMA, EL MCHIRA, OULED KHELLOUF",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 44,
    name: "Aïn Defla",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "A",
      },
    ],
  },
  {
    id: 45,
    name: "Naâma",
    defaultZone: "B",
    communes: [
      {
        name: "Groupe unique : Toutes les communes",
        zone: "B",
      },
    ],
  },
  {
    id: 46,
    name: "Aïn Témouchent",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : SIDI SAFI, BENI SAF, OULHACA GHERRABA, AIN TOLBA, EL EMIR ABDELKADER",
        zone: "A1",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
  {
    id: 47,
    name: "Ghardaïa",
    defaultZone: "C",
    communes: [
      {
        name: "Groupe 1 : EL GUERRARA, ZELFANA",
        zone: "D",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "C",
      },
    ],
  },
  {
    id: 48,
    name: "Relizane",
    defaultZone: "A",
    communes: [
      {
        name: "Groupe 1 : OUED ESSALEM",
        zone: "B",
      },
      {
        name: "Groupe 2 : Toutes les autres communes",
        zone: "A",
      },
    ],
  },
];