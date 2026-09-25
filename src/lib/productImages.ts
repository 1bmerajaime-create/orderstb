import laDulcecita from '../assets/bowls/la-dulcecita.png';
import laLotus from '../assets/bowls/la-lotus.png';
import laTropicoqueta from '../assets/bowls/la-tropicoqueta.png';
import { isCustomProduct } from './bowl';

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
  const key = (productName || '').trim().toLowerCase();
  if (key && BY_NAME[key]) return BY_NAME[key];
  if (productId && isCustomProduct(productId)) return laTropicoqueta;
  return laTropicoqueta;
}
