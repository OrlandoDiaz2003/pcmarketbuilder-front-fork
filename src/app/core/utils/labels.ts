import { Grade, PublicationStatus } from '../models/catalog.models';
import { NotificationStatus } from '../models/inspection.models';
import { InspectionStatus } from '../models/order.models';
import { SaleStage } from '../models/sale.models';

const GRADE_LABELS: Record<Grade, string> = {
  GRADE_A: 'Grado A (Excelente)',
  GRADE_B: 'Grado B (Bueno)',
  GRADE_C: 'Grado C (Detalle estético)',
};

const STATUS_LABELS: Record<PublicationStatus, string> = {
  ACTIVE: 'Activa',
  RESERVED: 'Reservada',
  SOLD: 'Vendida',
  IN_INSPECTION: 'En inspección',
  WITHDRAWN: 'Retirada',
};

const INSPECTION_LABELS: Record<InspectionStatus, string> = {
  PENDING: 'En espera de revisión',
  IN_REVIEW: 'En revisión del taller',
  PASSED: 'Aprobada: será enviada',
  FAILED: 'Rechazada: no será enviada',
  CANCELLED: 'Compra cancelada',
};

/**
 * null = el taller todavía no registra la pieza (el aviso de pago sigue en camino).
 * Una pieza aprobada y ya entregada se muestra como "Entregada".
 */
export function inspectionLabel(
  status: InspectionStatus | null | undefined,
  deliveredAt?: string | null,
): string {
  if (status === 'PASSED' && deliveredAt) return 'Entregada';
  return status ? (INSPECTION_LABELS[status] ?? status) : INSPECTION_LABELS.PENDING;
}

const STAGE_LABELS: Record<SaleStage, string> = {
  PAID: 'Pagada',
  IN_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  DELIVERED: 'Entregada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

/** Pasos de la línea de tiempo de una venta (el rechazo es una rama aparte). */
export const SALE_STEPS: SaleStage[] = ['PAID', 'IN_REVIEW', 'APPROVED', 'DELIVERED'];

export function stageLabel(stage: SaleStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

/** Explicación en una frase de en qué va la venta. */
export function stageHint(stage: SaleStage): string {
  switch (stage) {
    case 'PAID':
      return 'El comprador ya pagó. El taller revisará la pieza.';
    case 'IN_REVIEW':
      return 'El taller está revisando la pieza.';
    case 'APPROVED':
      return 'Aprobada por el taller. Falta la entrega al comprador.';
    case 'DELIVERED':
      return 'Entregada al comprador. ¡Venta completada!';
    case 'REJECTED':
      return 'No pasó la revisión: se devolvió el dinero al comprador y tu publicación volvió al catálogo.';
    case 'CANCELLED':
      return 'El taller canceló esta compra: se devolvió el dinero al comprador y tu publicación volvió al catálogo.';
  }
}

export function gradeLabel(grade: Grade): string {
  return GRADE_LABELS[grade] ?? grade;
}

export function statusLabel(status: PublicationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// "Miembro desde <Mes> <Año>", igual que el mockup de perfil. No usa el
// DatePipe de Angular porque el proyecto no registra el locale 'es'
// (registerLocaleData), así que 'MMMM' caería en nombres de mes en inglés.
export function memberSince(createdAt: string): string {
  const date = new Date(createdAt);
  const month = SPANISH_MONTHS[date.getMonth()];
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

const NOTIFICATION_LABELS: Record<NotificationStatus, string> = {
  PENDING: 'En curso',
  SENT: 'Enviado',
  NOT_SENT: 'No enviado',
  FAILED: 'Falló',
};

/** Texto corto del estado de un correo para el panel del taller. */
export function notificationLabel(status: NotificationStatus | null | undefined): string {
  return status ? NOTIFICATION_LABELS[status] : 'Sin dato';
}

const CATEGORY_LABELS: Record<string, string> = {
  Processors: 'Procesadores',
  'Graphics Cards': 'Tarjetas gráficas',
  RAM: 'Memoria RAM',
  Motherboards: 'Placas madre',
  Storage: 'Almacenamiento',
  Cooling: 'Refrigeración',
  Cases: 'Gabinetes',
  'Power Supplies': 'Fuentes de poder',
  SIN_CATEGORIA: 'Sin categoría',
};

/** Las subcategorías llegan en inglés en los datos; solo se traducen al mostrarlas. */
export function categoryLabel(name: string | null | undefined): string {
  if (!name) return 'Sin categoría';
  return CATEGORY_LABELS[name] ?? name;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  LISTING_VIEWED: 'Vistas de piezas',
  SEARCH_PERFORMED: 'Búsquedas',
  PUBLICATION_CREATED: 'Publicaciones nuevas',
  ORDER_PAID: 'Compras pagadas',
  INSPECTION_COMPLETED: 'Inspecciones cerradas',
  ORDER_DELIVERED: 'Entregas',
  ORDER_CANCELLED: 'Compras canceladas',
  ORDER_REFUNDED: 'Reembolsos',
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

const AUDIT_LABELS: Record<string, string> = {
  INSPECTION_APPROVED: 'Aprobó una pieza',
  INSPECTION_REJECTED: 'Rechazó una pieza',
  PIECE_DELIVERED: 'Entregó una pieza',
  PURCHASE_CANCELLED: 'Canceló una compra',
  ORDER_REFUNDED: 'Reembolsó una compra',
  NOTIFICATIONS_RESENT: 'Reenvió correos',
};

export function auditLabel(type: string): string {
  return AUDIT_LABELS[type] ?? type;
}
