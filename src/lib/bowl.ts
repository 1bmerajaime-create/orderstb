export const SOLID_TOPPINGS = [
  'Granola',
  'Almendra crocanti',
  'Lotus',
  'Coco rallado',
  'Galleta',
  'Choco chips',
] as const;

export const SOFT_TOPPINGS = [
  'Crema de cacahuete',
  'Miel',
  'Caramelo',
  'Crema de pistacho',
] as const;

export const FRUITS = ['Plátano', 'Mango', 'Fresa', 'Arándanos'] as const;

export const PISTACHIO = 'Crema de pistacho';
export const WHEY = 'Proteína whey';
export const CUSTOM_PRODUCT_ID = 'prod-custom';
export const CUSTOM_PRODUCT_PREFIX = 'prod-custom';

export function isCustomProduct(
  product: { id: string; name?: string } | string,
): boolean {
  if (typeof product === 'string') {
    return (
      product === CUSTOM_PRODUCT_ID || product.startsWith(`${CUSTOM_PRODUCT_PREFIX}-`)
    );
  }
  return (
    isCustomProduct(product.id) ||
    /crea\s+tu\s+a[cç]a[ií]/i.test(product.name || '')
  );
}

export const FREE_SOLID = 1;
export const FREE_SOFT = 1;
export const FREE_FRUITS = 2;
export const EXTRA_TOPPING_PRICE = 1;
export const PISTACHIO_SURCHARGE = 1;
export const WHEY_PRICE = 1.5;

export type LineDiscountType = 'none' | 'percent' | 'fixed';

export interface BowlConfig {
  solids: string[];
  softs: string[];
  fruits: string[];
  whey: boolean;
}

export function parseRecipe(ingredients: string[]): BowlConfig {
  const solids = ingredients.filter((item) =>
    (SOLID_TOPPINGS as readonly string[]).includes(item),
  );
  const softs = ingredients.filter((item) =>
    (SOFT_TOPPINGS as readonly string[]).includes(item),
  );
  const fruits = ingredients.filter((item) =>
    (FRUITS as readonly string[]).includes(item),
  );
  return {
    solids,
    softs,
    fruits,
    whey: ingredients.includes(WHEY),
  };
}

export function bowlIngredients(config: BowlConfig): string[] {
  return [
    'Açaí',
    ...config.solids,
    ...config.softs,
    ...config.fruits,
    ...(config.whey ? [WHEY] : []),
  ];
}

export function extraToppingsCount(config: BowlConfig): number {
  return (
    Math.max(0, config.solids.length - FREE_SOLID) +
    Math.max(0, config.softs.length - FREE_SOFT) +
    Math.max(0, config.fruits.length - FREE_FRUITS)
  );
}

export function bowlSurcharges(config: BowlConfig): {
  extras: number;
  pistachio: number;
  whey: number;
  total: number;
} {
  const extras = extraToppingsCount(config) * EXTRA_TOPPING_PRICE;
  const pistachio = config.softs.includes(PISTACHIO) ? PISTACHIO_SURCHARGE : 0;
  const whey = config.whey ? WHEY_PRICE : 0;
  return {
    extras,
    pistachio,
    whey,
    total: extras + pistachio + whey,
  };
}

export function bowlGrossPrice(basePrice: number, config: BowlConfig): number {
  return Math.round((basePrice + bowlSurcharges(config).total) * 100) / 100;
}

export function lineDiscountAmount(
  gross: number,
  type: LineDiscountType,
  value: number,
): number {
  if (type === 'none' || !value) return 0;
  if (type === 'percent') {
    return Math.min(gross, Math.round(((gross * value) / 100) * 100) / 100);
  }
  return Math.min(gross, Math.round(value * 100) / 100);
}

export function bowlNetPrice(
  basePrice: number,
  config: BowlConfig,
  discountType: LineDiscountType,
  discountValue: number,
): number {
  const gross = bowlGrossPrice(basePrice, config);
  return Math.round((gross - lineDiscountAmount(gross, discountType, discountValue)) * 100) / 100;
}

export function isBowlComplete(config: BowlConfig): boolean {
  return (
    config.solids.length >= FREE_SOLID &&
    config.softs.length >= FREE_SOFT &&
    config.fruits.length >= FREE_FRUITS
  );
}

export function toggleInList(list: string[], option: string): string[] {
  if (list.includes(option)) return list.filter((item) => item !== option);
  return [...list, option];
}

/** Indica si una opción seleccionada está fuera del cupo gratuito (es extra de pago). */
export function isPaidExtra(
  list: string[],
  option: string,
  maxFree: number,
): boolean {
  const index = list.indexOf(option);
  return index >= maxFree;
}
