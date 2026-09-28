import acaiImg from '../assets/toppings/acai.png';
import almendraImg from '../assets/toppings/almendra.png';
import arandanosImg from '../assets/toppings/arandanos.png';
import cacahueteImg from '../assets/toppings/cacahuete.png';
import carameloImg from '../assets/toppings/caramelo.png';
import chocoChipsImg from '../assets/toppings/choco-chips.png';
import cocoImg from '../assets/toppings/coco.png';
import fresaImg from '../assets/toppings/fresa.png';
import galletaImg from '../assets/toppings/galleta.png';
import granolaImg from '../assets/toppings/granola.png';
import lotusImg from '../assets/toppings/lotus.png';
import mangoImg from '../assets/toppings/mango.png';
import mielImg from '../assets/toppings/miel.png';
import pistachoImg from '../assets/toppings/pistacho.png';
import platanoImg from '../assets/toppings/platano.png';
import wheyImg from '../assets/toppings/whey.png';

/** Foto por ingrediente para la vista de pedido en progreso. */
const BY_NAME: Record<string, string> = {
  acai: acaiImg,
  granola: granolaImg,
  'almendra crocanti': almendraImg,
  lotus: lotusImg,
  'coco rallado': cocoImg,
  galleta: galletaImg,
  'choco chips': chocoChipsImg,
  'crema de cacahuete': cacahueteImg,
  miel: mielImg,
  caramelo: carameloImg,
  'crema de pistacho': pistachoImg,
  platano: platanoImg,
  mango: mangoImg,
  fresa: fresaImg,
  arandanos: arandanosImg,
  'proteina whey': wheyImg,
};

function normalizeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function ingredientImageUrl(name: string): string | undefined {
  return BY_NAME[normalizeKey(name)];
}

/** @deprecated usar ingredientImageUrl; se mantiene para fallbacks. */
export function ingredientVisual(name: string): {
  imageUrl?: string;
  emoji: string;
  tint: string;
} {
  const imageUrl = ingredientImageUrl(name);
  return {
    imageUrl,
    emoji: imageUrl ? '' : '🍽️',
    tint: 'rgba(168, 85, 224, 0.25)',
  };
}
