import { Grade, PublicationStatus } from '../models/catalog.models';
import { InspectionStatus } from '../models/order.models';

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

/** null = el taller todavía no registra la pieza (el aviso de pago sigue en camino). */
export function inspectionLabel(status: InspectionStatus | null | undefined): string {
  return status ? (INSPECTION_LABELS[status] ?? status) : INSPECTION_LABELS.PENDING;
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
