import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Order, OrderItem } from '../../../core/models/order.models';
import { OrderApiService } from '../../../core/services/order-api.service';
import { inspectionLabel } from '../../../core/utils/labels';

@Component({
  selector: 'app-my-orders',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrders implements OnInit {
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Mensaje de la descarga (p. ej. "el informe aún se está generando"). */
  readonly notice = signal<string | null>(null);
  readonly downloadingId = signal<string | null>(null);
  /** true si se llegó aquí justo después de comprar (viene en el state de la navegación). */
  readonly justPurchased: boolean;

  readonly inspectionLabel = inspectionLabel;

  constructor(
    private readonly api: OrderApiService,
    router: Router,
  ) {
    this.justPurchased = router.getCurrentNavigation()?.extras.state?.['justPurchased'] === true;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.myOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus compras.');
        this.loading.set(false);
      },
    });
  }

  /** El informe existe cuando el taller cerró la revisión (aprobada o rechazada). */
  hasReport(item: OrderItem): boolean {
    const status = item.inspection?.status;
    return status === 'PASSED' || status === 'FAILED';
  }

  statusOf(item: OrderItem): string {
    return item.inspection?.status ?? 'PENDING';
  }

  downloadReport(item: OrderItem): void {
    this.downloadingId.set(item.orderItemId);
    this.notice.set(null);
    this.api.downloadReport(item.orderItemId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `informe-tecnico-${item.orderItemId}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        // El PDF se genera por cola: justo después de cerrar la revisión puede no existir todavía.
        this.notice.set(
          err.status === 404
            ? 'El informe aún se está generando. Intenta de nuevo en unos segundos.'
            : 'No se pudo descargar el informe.',
        );
        this.downloadingId.set(null);
      },
    });
  }
}
