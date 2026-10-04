// ═══════════════════════════════════════════════════════
//  CATALOGUE EASY LINGE KECH — Grille Tarifaire Officielle
//  Source: Excel "MAY BUSINEES LINGE Vierge (2)"
//  Prix en MAD HT (Hors Taxe) — TVA 20%
// ═══════════════════════════════════════════════════════

export interface CatalogVariant {
  size: string;         // ex: "300x300 cm"
  priceDH: number;      // Prix unitaire HT en MAD
  weight?: string;      // ex: "500g/m²" (pour le linge de bain)
  bedSize?: string;     // ex: "180" (taille du lit associé)
}

export interface CatalogProduct {
  id: string;           // Identifiant unique (ex: "drap_plat_180")
  name: string;         // Nom commercial
  category: 'LINGE_LIT' | 'LINGE_BAIN';
  material: string;     // ex: "Polycoton 70% coton"
  variants: CatalogVariant[];
}

// ─── LINGE DE LIT — Polycoton 70% Coton ────────────────────────────────────

const DRAPS_PLATS: CatalogProduct = {
  id: 'drap_plat',
  name: 'Drap Plat',
  category: 'LINGE_LIT',
  material: 'Polycoton 70% coton',
  variants: [
    { size: '160x260 cm', priceDH: 115, bedSize: '90' },
    { size: '220x280 cm', priceDH: 153, bedSize: '140' },
    { size: '280x300 cm', priceDH: 153, bedSize: '160' },
    { size: '300x300 cm', priceDH: 173, bedSize: '180' },
    { size: '300x300 cm', priceDH: 173, bedSize: '200' },
  ],
};

const DRAPS_HOUSSE: CatalogProduct = {
  id: 'drap_housse',
  name: 'Drap-Housse',
  category: 'LINGE_LIT',
  material: 'Polycoton 70% coton',
  variants: [
    { size: '90x200 cm',  priceDH: 115, bedSize: '90' },
    { size: '140x200 cm', priceDH: 153, bedSize: '140' },
    { size: '160x200 cm', priceDH: 165, bedSize: '160' },
    { size: '180x200 cm', priceDH: 175, bedSize: '180' },
    { size: '200x200 cm', priceDH: 185, bedSize: '200' },
  ],
};

const PROTEGE_MATELAS: CatalogProduct = {
  id: 'protege_matelas',
  name: 'Protège-Matelas',
  category: 'LINGE_LIT',
  material: 'Protection respirante',
  variants: [
    { size: '90x200 cm',  priceDH: 142, bedSize: '90' },
    { size: '140x200 cm', priceDH: 190, bedSize: '140' },
    { size: '160x200 cm', priceDH: 225, bedSize: '160' },
    { size: '180x200 cm', priceDH: 270, bedSize: '180' },
    { size: '200x200 cm', priceDH: 280, bedSize: '200' },
  ],
};

const HOUSSES_COUETTE: CatalogProduct = {
  id: 'housse_couette',
  name: 'Housse de Couette',
  category: 'LINGE_LIT',
  material: 'Polycoton 70% coton',
  variants: [
    { size: '160x220 cm', priceDH: 203, bedSize: '90' },
    { size: '220x240 cm', priceDH: 250, bedSize: '140' },
    { size: '220x240 cm', priceDH: 250, bedSize: '160' },
    { size: '240x260 cm', priceDH: 290, bedSize: '180' },
    { size: '240x260 cm', priceDH: 290, bedSize: '200' },
  ],
};

const COUETTES: CatalogProduct = {
  id: 'couette',
  name: 'Couette Hôtelière',
  category: 'LINGE_LIT',
  material: 'Garnissage hôtelier',
  variants: [
    { size: '160x220 cm', priceDH: 250, bedSize: '90' },
    { size: '220x240 cm', priceDH: 324, bedSize: '140' },
    { size: '220x240 cm', priceDH: 324, bedSize: '160' },
    { size: '240x260 cm', priceDH: 424, bedSize: '180' },
    { size: '240x260 cm', priceDH: 424, bedSize: '200' },
  ],
};

const OREILLERS: CatalogProduct = {
  id: 'oreiller',
  name: 'Oreiller Hôtelier',
  category: 'LINGE_LIT',
  material: 'Confort moelleux',
  variants: [
    { size: '70x50 cm', priceDH: 82 },
  ],
};

const TAIES_OREILLER: CatalogProduct = {
  id: 'taie_oreiller',
  name: "Taie d'Oreiller",
  category: 'LINGE_LIT',
  material: 'Polycoton 70% coton',
  variants: [
    { size: '70x50 cm', priceDH: 37 },
  ],
};

const TAIES_VOLANT: CatalogProduct = {
  id: 'taie_volant',
  name: "Taie d'Oreiller à Volant",
  category: 'LINGE_LIT',
  material: 'Finition décorative',
  variants: [
    { size: '70x50 cm', priceDH: 46 },
  ],
};

const SURMATELAS: CatalogProduct = {
  id: 'surmatelas',
  name: 'Surmatelas Hôtelier 10 cm',
  category: 'LINGE_LIT',
  material: 'Confort premium',
  variants: [
    { size: '90x190x10 cm',  priceDH: 945,  bedSize: '90' },
    { size: '140x200x10 cm', priceDH: 1053, bedSize: '140' },
    { size: '160x200x10 cm', priceDH: 1400, bedSize: '160' },
    { size: '180x200x10 cm', priceDH: 1450, bedSize: '180' },
    { size: '200x200x10 cm', priceDH: 1624, bedSize: '200' },
  ],
};

// ─── LINGE DE BAIN — 100% Coton Blanc ──────────────────────────────────────

const DRAPS_BAIN: CatalogProduct = {
  id: 'drap_bain',
  name: 'Drap de Bain',
  category: 'LINGE_BAIN',
  material: '100% coton blanc',
  variants: [
    { size: '70x140 cm',  priceDH: 92,  weight: '500g/m²' },
    { size: '90x150 cm',  priceDH: 117, weight: '500g/m²' },
    { size: '90x150 cm',  priceDH: 135, weight: '600g/m²' },
    { size: '100x150 cm', priceDH: 180, weight: '700g/m²' },
  ],
};

const SERVIETTES_VISAGE: CatalogProduct = {
  id: 'serviette_visage',
  name: 'Serviette Visage',
  category: 'LINGE_BAIN',
  material: '100% coton blanc',
  variants: [
    { size: '50x90 cm',  priceDH: 47, weight: '500g/m²' },
    { size: '50x90 cm',  priceDH: 51, weight: '600g/m²' },
    { size: '50x100 cm', priceDH: 60, weight: '700g/m²' },
  ],
};

const SERVIETTES_CARREE: CatalogProduct = {
  id: 'serviette_carree',
  name: 'Serviette Carrée',
  category: 'LINGE_BAIN',
  material: '100% coton blanc',
  variants: [
    { size: '30x30 cm', priceDH: 12, weight: '500g/m²' },
  ],
};

const TAPIS_BAIN: CatalogProduct = {
  id: 'tapis_bain',
  name: 'Tapis de Bain',
  category: 'LINGE_BAIN',
  material: '100% coton blanc',
  variants: [
    { size: '50x80 cm', priceDH: 53, weight: '700g/m²' },
  ],
};

const PEIGNOIR_VELOURS: CatalogProduct = {
  id: 'peignoir_velours',
  name: 'Peignoir Velours',
  category: 'LINGE_BAIN',
  material: 'Toucher velours 500g/m²',
  variants: [
    { size: 'L-XL', priceDH: 460, weight: '500g/m²' },
  ],
};

const PEIGNOIR_BOUCLETTE: CatalogProduct = {
  id: 'peignoir_bouclette',
  name: 'Peignoir Bouclette',
  category: 'LINGE_BAIN',
  material: '100% coton éponge',
  variants: [
    { size: 'L',    priceDH: 270, weight: '350g/m²' },
    { size: 'XL',   priceDH: 270, weight: '350g/m²' },
    { size: 'L-XL', priceDH: 320, weight: '500g/m²' },
  ],
};

const PEIGNOIR_NID_ABEILLE: CatalogProduct = {
  id: 'peignoir_nid_abeille',
  name: "Peignoir Nid d'Abeille",
  category: 'LINGE_BAIN',
  material: 'Léger, respirant, séchage rapide',
  variants: [
    { size: 'L-XL', priceDH: 280 },
  ],
};

// ─── CATALOGUE COMPLET ─────────────────────────────────────────────────────

export const CATALOG: CatalogProduct[] = [
  // Linge de lit
  DRAPS_PLATS,
  DRAPS_HOUSSE,
  PROTEGE_MATELAS,
  HOUSSES_COUETTE,
  COUETTES,
  OREILLERS,
  TAIES_OREILLER,
  TAIES_VOLANT,
  SURMATELAS,
  // Linge de bain
  DRAPS_BAIN,
  SERVIETTES_VISAGE,
  SERVIETTES_CARREE,
  TAPIS_BAIN,
  PEIGNOIR_VELOURS,
  PEIGNOIR_BOUCLETTE,
  PEIGNOIR_NID_ABEILLE,
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** TVA au Maroc = 20% */
export const TVA_RATE = 0.20;

/** Calcul TTC */
export function toTTC(totalHT: number): number {
  return Math.round(totalHT * (1 + TVA_RATE) * 100) / 100;
}

/** Trouve un produit par son ID */
export function findProductById(id: string): CatalogProduct | undefined {
  return CATALOG.find(p => p.id === id);
}

/** Trouve un produit par nom (recherche flexible) */
export function findProductByName(name: string): CatalogProduct | undefined {
  const n = name.toLowerCase().trim();
  return CATALOG.find(p => p.name.toLowerCase().includes(n));
}

/** Cherche un variant par taille de lit */
export function findVariantByBedSize(product: CatalogProduct, bedSize: string): CatalogVariant | undefined {
  return product.variants.find(v => v.bedSize === bedSize);
}

/** Génère le texte catalogue pour le system prompt Gemini */
export function buildCatalogTextForPrompt(): string {
  const lines: string[] = [];
  let currentCategory = '';

  for (const product of CATALOG) {
    const catLabel = product.category === 'LINGE_LIT' ? 'Linge de lit' : 'Linge de bain';
    if (catLabel !== currentCategory) {
      currentCategory = catLabel;
      lines.push(`\n--- ${currentCategory} ---`);
    }

    const variants = product.variants.map(v => {
      let label = `${v.size}: ${v.priceDH} DH HT`;
      if (v.weight) label += ` (${v.weight})`;
      if (v.bedSize) label += ` [lit ${v.bedSize}cm]`;
      return label;
    }).join(' | ');

    lines.push(`• ${product.name} (${product.material}): ${variants}`);
  }

  return lines.join('\n');
}

/**
 * Résumé rapide des catégories pour présenter à un nouveau client
 */
export function getCategorySummary(): string {
  const litProducts = CATALOG.filter(p => p.category === 'LINGE_LIT').map(p => p.name);
  const bainProducts = CATALOG.filter(p => p.category === 'LINGE_BAIN').map(p => p.name);

  return `**Linge de lit** : ${litProducts.join(', ')}\n**Linge de bain** : ${bainProducts.join(', ')}`;
}
