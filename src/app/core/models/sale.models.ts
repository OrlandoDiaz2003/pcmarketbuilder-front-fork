import { PublicationStatus } from './catalog.models';

/** Etapa de una venta vista por el vendedor. */
export type SaleStage = 'PAID' | 'IN_REVIEW' | 'APPROVED' | 'DELIVERED' | 'REJECTED';

/** Una venta del usuario. Sin datos privados del comprador: solo su nombre de usuario público. */
export interface Sale {
  id: string;
  orderItemId: string;
  publicationId: string | null;
  title: string;
  price: number | null;
  image: string | null;
  /** Estado actual de la publicación (ACTIVE si la pieza fue rechazada y volvió al catálogo). */
  publicationStatus: PublicationStatus | null;
  stage: SaleStage;
  buyerUsername: string | null;
  paidAt: string;
  reviewedAt: string | null;
  deliveredAt: string | null;
}
