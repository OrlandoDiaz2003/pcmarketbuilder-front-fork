import { Grade, PublicationStatus } from '../models/catalog.models';
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
