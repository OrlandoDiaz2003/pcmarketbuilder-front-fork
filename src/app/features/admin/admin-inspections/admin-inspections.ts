import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentResult, Inspection } from '../../../core/models/inspection.models';
import { InspectionApiService } from '../../../core/services/inspection-api.service';
import { gradeLabel } from '../../../core/utils/labels';

interface CheckRow {
  component: string;
  result: ComponentResult;
  note: string;
}

/** AAAA-MM-DD en hora local (lo que espera <input type="date"> y el backend). */
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

@Component({
  selector: 'app-admin-inspections',
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './admin-inspections.html',
  styleUrl: './admin-inspections.css',
})
export class AdminInspections implements OnInit {
  /** "review": pendientes de revisión (formulario). "deliver": aprobadas por entregar. */
  readonly tab = signal<'review' | 'deliver'>('review');
  readonly inspections = signal<Inspection[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly selectedImageIndex = signal(0);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  /** Pasos que fallaron tras cerrar/entregar (reembolso, estado de la publicación) y se pueden reintentar. */
  readonly warnings = signal<{ inspectionId: string; messages: string[] } | null>(null);
  readonly retrying = signal(false);
  readonly deliveringId = signal<string | null>(null);

  readonly gradeLabel = gradeLabel;

  readonly selected = computed(() => this.inspections().find((i) => i.id === this.selectedId()) ?? null);

  /** Fotos de la publicación, la principal primero. */
  readonly images = computed(() => {
    const images = this.selected()?.listing?.images ?? [];
    return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  });

  /** Especificaciones del producto que existen (para comparar con la pieza física). */
  readonly specs = computed(() => {
    const product = this.selected()?.listing?.product;
    if (!product) return [];
    const rows: Array<[string, string | number | null]> = [
      ['Socket', product.socket],
      ['Formato', product.formFactor],
      ['Tipo de RAM', product.ramType],
      ['TDP (W)', product.tdpWatts],
      ['Potencia (W)', product.psuWatts],
      ['Slots de RAM', product.ramSlots],
      ['Almacenamiento', product.storageType],
    ];
    return rows.filter(([, value]) => value !== null && value !== '');
  });

  // Formulario de informe (se reinicia al elegir otra pieza).
  form = { result: 'PASSED' as 'PASSED' | 'FAILED', maintenanceDone: '', maintenanceDate: today(), notes: '' };
  checks: CheckRow[] = [];

  constructor(private readonly api: InspectionApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const request = this.tab() === 'deliver' ? this.api.listToDeliver() : this.api.listOpen();
    request.subscribe({
      next: (inspections) => {
        this.inspections.set(inspections);
        if (this.selectedId() && !inspections.some((i) => i.id === this.selectedId())) {
          this.selectedId.set(null);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.tab() === 'deliver'
            ? 'No se pudo cargar la lista de piezas por entregar.'
            : 'No se pudo cargar la bandeja de inspecciones.',
        );
        this.loading.set(false);
      },
    });
  }

  setTab(tab: 'review' | 'deliver'): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.selectedId.set(null);
    this.success.set(null);
    this.warnings.set(null);
    this.inspections.set([]);
    this.load();
  }

  /** El taller entrega la pieza aprobada: la venta se completa y la publicación pasa a "Vendida". */
  deliver(inspection: Inspection): void {
    if (this.deliveringId()) return;
    this.deliveringId.set(inspection.id);
    this.success.set(null);
    this.warnings.set(null);
    this.error.set(null);
    this.api.deliver(inspection.id).subscribe({
      next: (result) => {
        this.deliveringId.set(null);
        this.inspections.set(this.inspections().filter((i) => i.id !== inspection.id));
        this.success.set('Pieza marcada como entregada. La venta quedó completada.');
        this.showWarnings(inspection.id, result.warnings);
      },
      error: (err: HttpErrorResponse) => {
        this.deliveringId.set(null);
        this.error.set(err.error?.message ?? 'No se pudo marcar la pieza como entregada.');
        if (err.status === 409) this.load();
      },
    });
  }

  /** Reintenta los pasos pendientes (reembolso / estado de la publicación). Es idempotente. */
  retry(): void {
    const pending = this.warnings();
    if (!pending || this.retrying()) return;
    this.retrying.set(true);
    this.api.sync(pending.inspectionId).subscribe({
      next: (result) => {
        this.retrying.set(false);
        this.showWarnings(pending.inspectionId, result.warnings);
        if (!this.warnings()) this.success.set('Listo: los pasos pendientes se completaron.');
      },
      error: () => {
        this.retrying.set(false);
        this.error.set('No se pudo reintentar. Inténtalo de nuevo en unos segundos.');
      },
    });
  }

  private showWarnings(inspectionId: string, messages: string[] | undefined): void {
    this.warnings.set(messages && messages.length > 0 ? { inspectionId, messages } : null);
  }

  select(inspection: Inspection): void {
    this.selectedId.set(inspection.id);
    this.selectedImageIndex.set(0);
    this.success.set(null);
    this.formError.set(null);
    this.form = { result: 'PASSED', maintenanceDone: '', maintenanceDate: today(), notes: '' };
    this.checks = [];
  }

  primaryImage(inspection: Inspection): string | null {
    const images = inspection.listing?.images ?? [];
    return (images.find((i) => i.isPrimary) ?? images[0])?.imageUrl ?? null;
  }

  addCheck(): void {
    this.checks = [...this.checks, { component: '', result: 'OK', note: '' }];
  }

  removeCheck(index: number): void {
    this.checks = this.checks.filter((_, i) => i !== index);
  }

  submit(): void {
    const inspection = this.selected();
    if (!inspection || this.submitting()) return;

    const maintenanceDone = this.form.maintenanceDone.trim();
    if (!maintenanceDone) {
      this.formError.set('Describe el mantenimiento realizado.');
      return;
    }
    const checks = this.checks
      .filter((c) => c.component.trim() !== '')
      .map((c) => ({ component: c.component.trim(), result: c.result, note: c.note.trim() || undefined }));

    this.submitting.set(true);
    this.formError.set(null);
    this.api
      .complete(inspection.id, {
        result: this.form.result,
        maintenanceDone,
        maintenanceDate: this.form.maintenanceDate || undefined,
        notes: this.form.notes.trim() || undefined,
        checks: checks.length > 0 ? checks : undefined,
      })
      .subscribe({
        next: (result) => {
          this.inspections.set(this.inspections().filter((i) => i.id !== inspection.id));
          this.selectedId.set(null);
          this.submitting.set(false);
          this.success.set(
            `Informe enviado a proceso: se avisará a ${inspection.buyerEmail ?? 'el comprador'} y se le enviará el PDF.`,
          );
          this.showWarnings(inspection.id, result.warnings);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.formError.set(err.error?.message ?? 'No se pudo generar el informe.');
          // 409 = otra persona ya la cerró: se refresca la bandeja para que desaparezca.
          if (err.status === 409) this.load();
        },
      });
  }
}
