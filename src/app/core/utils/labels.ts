import { Grade, PublicationStatus } from '../models/catalog.models';

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
