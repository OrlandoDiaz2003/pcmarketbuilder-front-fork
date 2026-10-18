import { ListingDetail } from './catalog.models';
import { InspectionStatus } from './order.models';

export type ComponentResult = 'OK' | 'WARNING' | 'FAIL';

export interface ComponentCheck {
  component: string;
  result: ComponentResult;
  note: string | null;
}

/** Una pieza pagada esperando revisión en el taller, con los datos de la publicación para compararla. */
export interface Inspection {
  id: string;
  orderId: string;
  orderItemId: string;
  publicationId: string | null;
  description: string | null;
  buyerId: string;
  buyerEmail: string | null;
  sellerId: string;
  status: InspectionStatus;
  maintenanceDone: string | null;
  maintenanceDate: string | null;
  workshopNotes: string | null;
  checks: ComponentCheck[];
  completedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  /** null si la publicación ya no existe o no se pudo consultar. */
  listing: ListingDetail | null;
  /** Pasos posteriores que el BFF no pudo aplicar (reembolso, estado de la publicación). Se reintentan con `sync`. */
  warnings?: string[];
}

/** Formulario del admin. maintenanceDate: AAAA-MM-DD. */
export interface CompleteInspectionRequest {
  result: 'PASSED' | 'FAILED';
  maintenanceDone: string;
  maintenanceDate?: string;
  notes?: string;
  checks?: Array<{ component: string; result: ComponentResult; note?: string }>;
}
