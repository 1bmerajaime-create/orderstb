import laDulcecita from '../assets/bowls/la-dulcecita.png';
import laLotus from '../assets/bowls/la-lotus.png';
import laTropicoqueta from '../assets/bowls/la-tropicoqueta.png';
import { CUSTOM_PRODUCT_ID } from './bowl';

const BY_ID: Record<string, string> = {
  'prod-dulcecita': laDulcecita,
  'prod-lotus': laLotus,
  'prod-tropicoqueta': laTropicoqueta,
  [CUSTOM_PRODUCT_ID]: laTropicoqueta,
};

const BY_NAME: Record<string, string> = {
  'la dulcecita': laDulcecita,
  'la lotus': laLotus,
  'la tropicoqueta': laTropicoqueta,
  'crea tu açaí': laTropicoqueta,
  'crea tu acai': laTropicoqueta,
};

/** Imagen de producto; fallback genérico para custom / desconocidos. */
export function productImageUrl(
  productId?: string,
  productName?: string,
): string {
  if (productId && BY_ID[productId]) return BY_ID[productId];
  const key = (productName || '').trim().toLowerCase();
  if (key && BY_NAME[key]) return BY_NAME[key];
  return laTropicoqueta;
}
