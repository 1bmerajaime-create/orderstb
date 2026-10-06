import {
  FRUITS,
  SOLID_TOPPINGS,
  SOFT_TOPPINGS,
} from './bowl';
import type {
  AppData,
  BowlSize,
  Material,
  MaterialKind,
  Product,
  ProductRecipe,
  ResolvedProduct,
} from '../types';

export const DEFAULT_BOWL_SIZE = 500;

export type BowlSizeMl = number;

/** Tamaños de vaso: 350 y 500 ml. */
export const ALLOWED_BOWL_MLS = [350, 500] as const;

/** Tamaños base del negocio. */
export const CANONICAL_SIZES: BowlSize[] = [
  { id: 'size-350', ml: 350, price: 10 },
  { id: 'size-500', ml: 500, price: 12 },
];

/** Tamaño unitario para productos simples (agua, refresco…). */
export const UNIT_SIZE: BowlSize = {
  id: 'size-ud',
  ml: 0,
  price: 0,
  label: 'Ud.',
};

/** Recetas fijas de bowls con imágenes y flujo de pedido. */
export const CANONICAL_RECIPES: ProductRecipe[] = [
  {
    id: 'prod-dulcecita',
    name: 'La Dulcecita',
    description: 'Açaí con almendra crocanti, mango, arándanos y miel.',
    ingredients: ['Açaí', 'Almendra crocanti', 'Mango', 'Arándanos', 'Miel'],
    kind: 'bowl',
  },
  {
    id: 'prod-tropicoqueta',
    name: 'La Tropicoqueta',
    description: 'Açaí con granola, crema de cacahuete, plátano y fresa.',
    ingredients: [
      'Açaí',
      'Granola',
      'Crema de cacahuete',
      'Plátano',
      'Fresa',
    ],
    kind: 'bowl',
  },
  {
    id: 'prod-lotus',
    name: 'La Lotus',
    description: 'Açaí con Lotus, caramelo, plátano y arándanos.',
    ingredients: ['Açaí', 'Lotus', 'Caramelo', 'Plátano', 'Arándanos'],
    kind: 'bowl',
  },
  {
    id: 'prod-custom',
    name: 'Crea tu Açaí',
    description: 'Elige 1 topping sólido, 1 topping blando y 2 frutas.',
    ingredients: ['Açaí'],
    kind: 'bowl',
  },
];

/** Bebidas / productos simples (sin builder de toppings). */
export const CANONICAL_SIMPLE_RECIPES: ProductRecipe[] = [
  {
    id: 'prod-agua',
    name: 'Agua',
    description: 'Botella de agua',
    ingredients: [],
    kind: 'simple',
    unitPrice: 2,
  },
  {
    id: 'prod-refresco',
    name: 'Refresco',
    description: 'Refresco',
    ingredients: [],
    kind: 'simple',
    unitPrice: 2.5,
  },
];

export function isSimpleRecipe(
  recipe: Pick<ProductRecipe, 'kind' | 'id' | 'name'> | null | undefined,
): boolean {
  if (!recipe) return false;
  if (recipe.kind === 'simple') return true;
  if (recipe.kind === 'bowl') return false;
  const key = (recipe.name || '').trim().toLowerCase();
  return key === 'agua' || key === 'refresco';
}

export function formatSizeLabel(size: Pick<BowlSize, 'ml' | 'label'>): string {
  if (size.label) return size.label;
  if (!size.ml) return 'Ud.';
  return `${size.ml} ml`;
}

export function isUnitSize(size: Pick<BowlSize, 'id' | 'ml' | 'label'>): boolean {
  return size.id === UNIT_SIZE.id || size.ml === 0 || size.label === 'Ud.';
}

export function isSupportedBowlSize(
  size: Pick<BowlSize, 'id' | 'ml' | 'label'>,
): boolean {
  if (isUnitSize(size)) return true;
  return (ALLOWED_BOWL_MLS as readonly number[]).includes(size.ml);
}

export interface ProductGroup {
  name: string;
  recipeId: string;
  variants: ResolvedProduct[];
  kind: 'bowl' | 'simple';
}

export function resolveLine(
  line: Product,
  recipes: ProductRecipe[],
  sizes: BowlSize[],
): ResolvedProduct | null {
  const recipe = recipes.find((item) => item.id === line.recipeId);
  const size = sizes.find((item) => item.id === line.sizeId);
  if (!recipe || !size) return null;
  const simple = isSimpleRecipe(recipe);
  return {
    id: line.id,
    recipeId: recipe.id,
    sizeId: size.id,
    name: recipe.name,
    description: recipe.description || '',
    ingredients: recipe.ingredients || [],
    size: simple ? 0 : Number(size.ml) || DEFAULT_BOWL_SIZE,
    price: simple
      ? Number(recipe.unitPrice) || Number(size.price) || 0
      : Number(size.price) || 0,
    kind: simple ? 'simple' : 'bowl',
    imageUrl: recipe.imageUrl,
    sizeLabel: formatSizeLabel(size),
  };
}

export function resolveAllProducts(
  products: Product[],
  recipes: ProductRecipe[],
  sizes: BowlSize[],
): ResolvedProduct[] {
  return products
    .map((line) => resolveLine(line, recipes, sizes))
    .filter((item): item is ResolvedProduct => item != null)
    .sort((a, b) => {
      // Bowls primero, bebidas/simples después
      const kindRank = (k: ResolvedProduct['kind']) => (k === 'simple' ? 1 : 0);
      const byKind = kindRank(a.kind) - kindRank(b.kind);
      if (byKind !== 0) return byKind;
      const byName = a.name.localeCompare(b.name, 'es');
      if (byName !== 0) return byName;
      return a.size - b.size;
    });
}

export function groupProductsByName(
  products: ResolvedProduct[],
): ProductGroup[] {
  const map = new Map<string, ResolvedProduct[]>();
  for (const product of products) {
    const key = product.recipeId || product.name;
    const list = map.get(key) || [];
    list.push(product);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([, variants]) => {
      const sorted = [...variants].sort((a, b) => a.size - b.size);
      return {
        name: sorted[0].name,
        recipeId: sorted[0].recipeId,
        variants: sorted,
        kind: sorted[0].kind,
      };
    })
    .sort((a, b) => {
      const kindRank = (k: ResolvedProduct['kind']) => (k === 'simple' ? 1 : 0);
      const byKind = kindRank(a.kind) - kindRank(b.kind);
      if (byKind !== 0) return byKind;
      return a.name.localeCompare(b.name, 'es');
    });
}

export function defaultVariant(variants: ResolvedProduct[]): ResolvedProduct {
  if (variants.length === 0) {
    throw new Error('No hay variantes de producto');
  }
  return (
    variants.find((item) => item.size === DEFAULT_BOWL_SIZE) ||
    variants[variants.length - 1]
  );
}

export function variantForSize(
  variants: ResolvedProduct[],
  size: number,
): ResolvedProduct | undefined {
  return variants.find((item) => item.size === size);
}

export function productSizeMl(product: { size: number }): number {
  return Number(product.size) || DEFAULT_BOWL_SIZE;
}

export function sizeIdForMl(ml: number): string {
  return `size-${ml}`;
}

function isLineProduct(raw: unknown): raw is Product {
  if (!raw || typeof raw !== 'object') return false;
  const item = raw as Record<string, unknown>;
  return (
    typeof item.recipeId === 'string' &&
    typeof item.sizeId === 'string' &&
    item.recipeId.length > 0 &&
    item.sizeId.length > 0
  );
}

function isLegacyProduct(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const item = raw as Record<string, unknown>;
  return (
    typeof item.name === 'string' &&
    (item.size != null || item.price350 != null || item.price500 != null)
  );
}

function inferMaterialKind(name: string): MaterialKind {
  if ((FRUITS as readonly string[]).includes(name)) return 'fruta';
  if ((SOLID_TOPPINGS as readonly string[]).includes(name)) return 'topping_duro';
  if ((SOFT_TOPPINGS as readonly string[]).includes(name)) return 'topping_blando';
  if (name === 'Galleta Lotus') return 'topping_duro';
  return 'otro';
}

export function migrateMaterials(materials: Material[]): Material[] {
  return (materials || []).map((material) => {
    const legacyKind = material.kind as MaterialKind | 'topping' | undefined;
    let kind: MaterialKind;
    if (legacyKind === 'topping') {
      kind = inferMaterialKind(material.name);
      if (kind === 'otro') kind = 'topping_duro';
    } else if (
      legacyKind === 'fruta' ||
      legacyKind === 'topping_duro' ||
      legacyKind === 'topping_blando' ||
      legacyKind === 'otro'
    ) {
      kind = legacyKind;
    } else {
      kind = inferMaterialKind(material.name);
    }
    return {
      ...material,
      kind,
      name: material.name === 'Galleta Lotus' ? 'Lotus' : material.name,
    };
  });
}

type LegacyProduct = {
  id: string;
  name: string;
  description?: string;
  ingredients?: string[];
  size?: number;
  price?: number;
  price350?: number;
  price500?: number;
  tag?: string;
  kcal?: number;
};

/** Garantiza recetas, tamaños y líneas canónicas (con imágenes en pedido). */
export function ensureCanonicalCatalog(input: {
  recipes: ProductRecipe[];
  sizes: BowlSize[];
  products: Product[];
}): {
  recipes: ProductRecipe[];
  sizes: BowlSize[];
  products: Product[];
} {
  const recipes = new Map(
    (input.recipes || []).map((recipe) => [recipe.id, recipe]),
  );
  const sizes = new Map((input.sizes || []).map((size) => [size.id, size]));
  const products = new Map(
    (input.products || []).map((product) => [product.id, product]),
  );

  for (const recipe of CANONICAL_RECIPES) {
    const existing = recipes.get(recipe.id);
    recipes.set(recipe.id, {
      ...recipe,
      ingredients: [...recipe.ingredients],
      // Conservar imagen subida por el usuario
      imageUrl: existing?.imageUrl || recipe.imageUrl,
      kind: 'bowl',
    });
  }

  for (const recipe of CANONICAL_SIMPLE_RECIPES) {
    const existing = recipes.get(recipe.id);
    recipes.set(recipe.id, {
      ...recipe,
      ingredients: [...(existing?.ingredients ?? recipe.ingredients)],
      imageUrl: existing?.imageUrl || recipe.imageUrl,
      unitPrice:
        existing?.unitPrice != null ? existing.unitPrice : recipe.unitPrice,
      kind: 'simple',
      name: existing?.name || recipe.name,
      description: existing?.description ?? recipe.description,
    });
  }

  for (const size of CANONICAL_SIZES) {
    sizes.set(size.id, { ...size });
  }
  const existingUnit = sizes.get(UNIT_SIZE.id);
  sizes.set(UNIT_SIZE.id, {
    ...UNIT_SIZE,
    label: existingUnit?.label || UNIT_SIZE.label,
  });

  for (const [id, size] of [...sizes.entries()]) {
    if (!isSupportedBowlSize(size)) sizes.delete(id);
  }
  for (const [id, product] of [...products.entries()]) {
    if (!sizes.has(product.sizeId)) products.delete(id);
  }

  for (const recipe of CANONICAL_RECIPES) {
    for (const size of CANONICAL_SIZES) {
      const lineId = `${recipe.id}-${size.ml}`;
      if (!products.has(lineId)) {
        products.set(lineId, {
          id: lineId,
          recipeId: recipe.id,
          sizeId: size.id,
        });
      }
    }
  }

  for (const recipe of CANONICAL_SIMPLE_RECIPES) {
    const lineId = `${recipe.id}-ud`;
    if (!products.has(lineId)) {
      products.set(lineId, {
        id: lineId,
        recipeId: recipe.id,
        sizeId: UNIT_SIZE.id,
      });
    }
  }

  return {
    recipes: [...recipes.values()],
    sizes: [...sizes.values()].sort((a, b) => {
      if (a.ml === 0 && b.ml !== 0) return 1;
      if (b.ml === 0 && a.ml !== 0) return -1;
      return a.ml - b.ml;
    }),
    products: [...products.values()],
  };
}

/** Normaliza catálogo legacy (filas planas) a recipes + sizes + lines. */
export function migrateCatalog(data: AppData): Pick<
  AppData,
  'recipes' | 'sizes' | 'products' | 'materials'
> {
  const materials = migrateMaterials(data.materials || []);
  const rawProducts = (data.products || []) as unknown[];
  const existingRecipes = data.recipes || [];
  const existingSizes = data.sizes || [];

  const allLines =
    rawProducts.length > 0 && rawProducts.every(isLineProduct);

  if (allLines && existingRecipes.length > 0 && existingSizes.length > 0) {
    const catalog = ensureCanonicalCatalog({
      recipes: existingRecipes,
      sizes: existingSizes,
      products: rawProducts as Product[],
    });
    return { ...catalog, materials };
  }

  const recipes = new Map<string, ProductRecipe>();
  const sizes = new Map<string, BowlSize>();
  const products: Product[] = [];
  const seenLine = new Set<string>();

  for (const recipe of existingRecipes) {
    recipes.set(recipe.id, recipe);
  }
  for (const size of existingSizes) {
    sizes.set(size.id, size);
  }

  function ensureSize(ml: number, price: number) {
    const id = sizeIdForMl(ml);
    if (!sizes.has(id)) {
      sizes.set(id, { id, ml, price });
    }
  }

  function ensureRecipe(base: {
    id: string;
    name: string;
    description?: string;
    ingredients?: string[];
  }) {
    const id = base.id.replace(/-(350|500)$/, '');
    if (!recipes.has(id)) {
      recipes.set(id, {
        id,
        name: base.name,
        description: base.description || '',
        ingredients: base.ingredients || [],
      });
    }
    return id;
  }

  for (const raw of rawProducts) {
    if (isLineProduct(raw)) {
      if (!seenLine.has(raw.id)) {
        seenLine.add(raw.id);
        products.push(raw);
      }
      continue;
    }

    if (!isLegacyProduct(raw)) continue;
    const legacy = raw as LegacyProduct;

    if (legacy.price350 != null || legacy.price500 != null) {
      const recipeId = ensureRecipe({
        id: legacy.id,
        name: legacy.name,
        description: legacy.description,
        ingredients: legacy.ingredients,
      });
      const variants = [
        { ml: 350, price: Number(legacy.price350 ?? 10) || 10 },
        {
          ml: 500,
          price: Number(legacy.price500 ?? legacy.price ?? 12) || 12,
        },
      ];
      for (const variant of variants) {
        ensureSize(variant.ml, variant.price);
        const lineId = `${recipeId}-${variant.ml}`;
        if (!seenLine.has(lineId)) {
          seenLine.add(lineId);
          products.push({
            id: lineId,
            recipeId,
            sizeId: sizeIdForMl(variant.ml),
          });
        }
      }
      continue;
    }

    const ml = Number(legacy.size) || DEFAULT_BOWL_SIZE;
    const price = Number(legacy.price) || (ml === 350 ? 10 : 12);
    const recipeId = ensureRecipe({
      id: legacy.id,
      name: legacy.name,
      description: legacy.description,
      ingredients: legacy.ingredients,
    });
    ensureSize(ml, price);
    const lineId = legacy.id.includes(`-${ml}`)
      ? legacy.id
      : `${recipeId}-${ml}`;
    if (!seenLine.has(lineId)) {
      seenLine.add(lineId);
      products.push({
        id: lineId,
        recipeId,
        sizeId: sizeIdForMl(ml),
      });
    }
  }

  const catalog = ensureCanonicalCatalog({
    recipes: [...recipes.values()],
    sizes: [...sizes.values()],
    products,
  });

  return { ...catalog, materials };
}
