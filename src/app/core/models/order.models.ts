export type PaymentStatus = 'PENDING' | 'HOLD_ESCROW' | 'RELEASED_TO_SELLER' | 'REFUNDED';

/** Estado de la revisión técnica de la pieza en el taller. */
export type InspectionStatus = 'PENDING' | 'IN_REVIEW' | 'PASSED' | 'FAILED';

export interface OrderItemInspection {
  status: InspectionStatus;
  completedAt: string | null;
}

export interface OrderItem {
  orderItemId: string;
  publicationId: string;
  sellerId: string;
  description: string | null;
  price: number;
  /** null = el taller aún no registra la pieza (el aviso de pago todavía está en camino). */
  inspection: OrderItemInspection | null;
}

export interface Order {
  orderId: string;
  buyerEmail: string | null;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: OrderItem[];
}

export interface CheckoutRequest {
  publicationIds: string[];
  /** Correo donde el comprador quiere recibir la confirmación y el informe técnico. */
  buyerEmail: string;
}
