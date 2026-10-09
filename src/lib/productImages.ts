import laDulcecita from '../assets/bowls/la-dulcecita.png';
import laLotus from '../assets/bowls/la-lotus.png';
import laTropicoqueta from '../assets/bowls/la-tropicoqueta.png';
import aguaImg from '../assets/drinks/agua.png';
import refrescoImg from '../assets/drinks/refresco.png';
import { isCustomProduct } from './bowl';

const BY_NAME: Record<string, string> = {
  'la dulcecita': laDulcecita,
  'la lotus': laLotus,
  'la tropicoqueta': laTropicoqueta,
  'crea tu açaí': laTropicoqueta,
  'crea tu acai': laTropicoqueta,
  agua: aguaImg,
  refresco: refrescoImg,
  cafe: refrescoImg,
  café: refrescoImg,
};

/** Imagen de producto; prioriza imageUrl de receta, luego nombre, luego fallback. */
export function productImageUrl(
  productId?: string,
  productName?: string,
  imageUrl?: string,
): string {
  if (imageUrl) return imageUrl;
  const key = (productName || '').trim().toLowerCase();
  if (key && BY_NAME[key]) return BY_NAME[key];
  if (productId && isCustomProduct(productId)) return laTropicoqueta;
  return laTropicoqueta;
}

/** Comprime una imagen a JPEG data URL para guardar en la receta. */
export function compressImageFile(
  file: File,
  maxPx = 720,
  quality = 0.72,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen no válida'));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
