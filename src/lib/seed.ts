import type { AppData } from '../types';

export const PASSWORD = 'tropic.boost';

export const seedData: AppData = {
  events: [
    {
      id: 'evt-hyrox-mad',
      name: 'Hyrox Madrid',
      date: '2026-08-08',
      endDate: '2026-08-09',
      place: 'IFEMA, Madrid',
      cost: 850,
      createdAt: new Date().toISOString(),
      materialsUsed: [],
    },
    {
      id: 'evt-crossfit-bcn',
      name: 'CrossFit Open Barcelona',
      date: '2026-08-15',
      endDate: '2026-08-15',
      place: 'Parc del Fòrum, Barcelona',
      cost: 720,
      createdAt: new Date().toISOString(),
      materialsUsed: [],
    },
    {
      id: 'evt-trail-val',
      name: 'Valencia Running Trail',
      date: '2026-09-03',
      endDate: '2026-09-05',
      place: 'Ciudad de las Artes, Valencia',
      cost: 480,
      createdAt: new Date().toISOString(),
      materialsUsed: [],
    },
  ],
  products: [
    {
      id: 'prod-dulcecita',
      name: 'La Dulcecita',
      description:
        'Açaí con almendra crocanti, mango, arándanos y miel.',
      ingredients: ['Açaí', 'Almendra crocanti', 'Mango', 'Arándanos', 'Miel'],
      price: 7.5,
      tag: 'Receta de la casa',
    },
    {
      id: 'prod-tropicoqueta',
      name: 'La Tropicoqueta',
      description:
        'Açaí con granola, crema de cacahuete, plátano y fresa.',
      ingredients: ['Açaí', 'Granola', 'Crema de cacahuete', 'Plátano', 'Fresa'],
      price: 7.9,
      tag: 'Receta de la casa',
    },
    {
      id: 'prod-lotus',
      name: 'La Lotus',
      description:
        'Açaí con Lotus, caramelo, plátano y arándanos.',
      ingredients: ['Açaí', 'Lotus', 'Caramelo', 'Plátano', 'Arándanos'],
      price: 8.2,
      tag: 'Receta de la casa',
    },
    {
      id: 'prod-custom',
      name: 'Crea tu Açaí',
      description:
        'Elige 1 topping sólido, 1 topping blando y 2 frutas.',
      ingredients: ['Açaí'],
      price: 7.2,
      tag: 'Personalizable',
    },
  ],
  materials: [
    { id: 'mat-acai', name: 'Açaí base', price: 4.2, unit: 'kg' },
    { id: 'mat-platano', name: 'Plátano', price: 1.8, unit: 'kg' },
    { id: 'mat-fresa', name: 'Fresa', price: 3.5, unit: 'kg' },
    { id: 'mat-arandanos', name: 'Arándanos', price: 6.5, unit: 'kg' },
    { id: 'mat-mango', name: 'Mango', price: 2.9, unit: 'kg' },
    { id: 'mat-granola', name: 'Granola', price: 3.2, unit: 'kg' },
    { id: 'mat-almendra', name: 'Almendra crocanti', price: 5.5, unit: 'kg' },
    { id: 'mat-pb', name: 'Crema de cacahuete', price: 5.5, unit: 'kg' },
    { id: 'mat-lotus', name: 'Galleta Lotus', price: 4.8, unit: 'kg' },
    { id: 'mat-galleta', name: 'Galleta', price: 3.1, unit: 'kg' },
    { id: 'mat-coco', name: 'Coco rallado', price: 4.0, unit: 'kg' },
    { id: 'mat-choco', name: 'Choco chips', price: 5.2, unit: 'kg' },
    { id: 'mat-miel', name: 'Miel', price: 6.0, unit: 'kg' },
    { id: 'mat-caramelo', name: 'Caramelo', price: 4.5, unit: 'kg' },
    { id: 'mat-pistacho', name: 'Crema de pistacho', price: 9.0, unit: 'kg' },
    { id: 'mat-whey', name: 'Proteína whey', price: 22, unit: 'kg' },
  ],
  promotions: [
    {
      id: 'promo-10',
      name: '10% descuento',
      type: 'percent',
      value: 10,
      description: '10% sobre el total',
    },
    {
      id: 'promo-2e',
      name: '2 € de descuento',
      type: 'fixed',
      value: 2,
      description: 'Descuento fijo de 2 €',
    },
    {
      id: 'promo-50',
      name: 'Segundo bowl al 50%',
      type: 'second_half',
      value: 50,
      description: 'El bowl más barato al 50%',
    },
    {
      id: 'promo-staff',
      name: 'Staff',
      type: 'percent',
      value: 20,
      description: 'Descuento equipo / staff',
    },
    {
      id: 'promo-sponsor',
      name: 'Patrocinador',
      type: 'percent',
      value: 15,
      description: 'Descuento patrocinadores',
    },
  ],
  orders: [],
  orderCounter: {},
};
