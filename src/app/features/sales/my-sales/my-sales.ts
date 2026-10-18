import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sale, SaleStage } from '../../../core/models/sale.models';
import { SaleApiService } from '../../../core/services/sale-api.service';
import { SALE_STEPS, stageHint, stageLabel } from '../../../core/utils/labels';

type StepState = 'done' | 'current' | 'pending';

@Component({
  selector: 'app-my-sales',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './my-sales.html',
  styleUrl: './my-sales.css',
})
export class MySales implements OnInit {
  readonly sales = signal<Sale[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly stageLabel = stageLabel;
  readonly stageHint = stageHint;
  readonly steps = SALE_STEPS;

  constructor(private readonly api: SaleApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.mySales().subscribe({
      next: (sales) => {
        this.sales.set(sales);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus ventas.');
        this.loading.set(false);
      },
    });
  }

  /** Estado de cada paso de la línea de tiempo: los anteriores a la etapa actual están hechos, y la entrega completa todo. */
  stepState(step: SaleStage, stage: SaleStage): StepState {
    if (stage === 'REJECTED') return step === 'PAID' ? 'done' : 'pending';
    const current = SALE_STEPS.indexOf(stage);
    const index = SALE_STEPS.indexOf(step);
    if (stage === 'DELIVERED' || index < current) return 'done';
    return index === current ? 'current' : 'pending';
  }

  /** Fecha de cada paso, si ya ocurrió. */
  stepDate(step: SaleStage, sale: Sale): string | null {
    switch (step) {
      case 'PAID':
        return sale.paidAt;
      case 'APPROVED':
        return sale.stage === 'APPROVED' || sale.stage === 'DELIVERED' ? sale.reviewedAt : null;
      case 'DELIVERED':
        return sale.deliveredAt;
      default:
        return null;
    }
  }

  /** La pieza rechazada volvió al catálogo: se ofrece ir a verla. */
  backInCatalog(sale: Sale): boolean {
    return sale.stage === 'REJECTED' && sale.publicationStatus === 'ACTIVE' && !!sale.publicationId;
  }
}
