export type PaymentMethod = 'tarjeta' | 'efectivo' | 'bizum' | 'pendiente';

export type OrderStatus =
  | 'pendiente'
  | 'en_preparacion'
  | 'listo'
  | 'entregado';

export type DiscountType = 'percent' | 'fixed' | 'bogo' | 'second_half';

export interface EventMaterialUsed {
  id: string;
  materialId?: string;
  name: string;
  quantity: number;
  unit: string;
  /** Precio por unidad */
  unitPrice: number;
}

export interface Event {
  id: string;
  name: string;
  /** Fecha de inicio (YYYY-MM-DD) */
  date: string;
  /** Fecha de fin inclusive (YYYY-MM-DD). Si falta, = date */
  endDate: string;
  place: string;
  cost: number;
  createdAt: string;
  /** Materia prima gastada en el evento */
  materialsUsed: EventMaterialUsed[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  price: number;
  kcal?: number;
  tag?: string;
}

export interface Material {
  id: string;
  name: string;
  price: number;
  unit?: string;
}

export interface Promotion {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  description?: string;
}

export interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  /** Foto de los ingredientes elegidos en el momento de crear el pedido. */
  ingredients?: string[];
  /** La receta preestablecida se modificó para este bowl. */
  customized?: boolean;
}

export interface Order {
  id: string;
  number: number;
  eventId: string;
  customerName: string;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  total: number;
  promotionId?: string;
  promotionName?: string;
  paymentMethod: PaymentMethod;
  paid: boolean;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface AppData {
  events: Event[];
  products: Product[];
  materials: Material[];
  promotions: Promotion[];
  orders: Order[];
  orderCounter: Record<string, number>;
}
