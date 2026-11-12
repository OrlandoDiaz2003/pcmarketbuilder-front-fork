import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval } from 'rxjs';
import { AuditEntry, Metric } from '../../../core/models/analytics.models';
import { AnalyticsApiService } from '../../../core/services/analytics-api.service';
import { auditLabel, categoryLabel, eventTypeLabel } from '../../../core/utils/labels';

/** Cada cuántos segundos se refresca sola la página mientras está activado. */
const REFRESH_SECONDS = 15;

interface Bar {
  label: string;
  count: number;
  amount: number;
  /** Ancho de la barra, 0–100, respecto al mayor de su grupo. */
  percent: number;
}

/** Barras proporcionales al mayor valor del grupo (por monto o por cantidad). */
function toBars(rows: Metric[], by: 'amount' | 'count', labelOf: (m: Metric) => string): Bar[] {
  const max = Math.max(1, ...rows.map((m) => m[by]));
  return rows.map((m) => ({ label: labelOf(m), count: m.count, amount: m.amount, percent: Math.round((m[by] / max) * 100) }));
}

/** Analítica y auditoría para el taller: se arma con los eventos de Kafka que procesa analytics-service. */
@Component({
  selector: 'app-admin-analytics',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './admin-analytics.html',
  styleUrl: './admin-analytics.css',
})
export class AdminAnalytics implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly updatedAt = signal<Date | null>(null);
  readonly autoRefresh = signal(true);

  readonly events = signal<Metric[]>([]);
  readonly categories = signal<Metric[]>([]);
  readonly products = signal<Metric[]>([]);
  readonly sellers = signal<Metric[]>([]);
  readonly inspections = signal<Metric[]>([]);
  readonly audit = signal<AuditEntry[]>([]);

  readonly eventLabel = eventTypeLabel;
  readonly auditLabel = auditLabel;
  readonly refreshSeconds = REFRESH_SECONDS;

  private count(type: string): number {
    return this.events().find((m) => m.key === type)?.count ?? 0;
  }

  readonly orders = computed(() => this.count('ORDER_PAID'));
  readonly views = computed(() => this.count('LISTING_VIEWED'));
  readonly revenue = computed(() => this.categories().reduce((sum, m) => sum + m.amount, 0));
  readonly passed = computed(() => this.inspections().find((m) => m.key === 'PASSED')?.count ?? 0);
  readonly failed = computed(() => this.inspections().find((m) => m.key === 'FAILED')?.count ?? 0);

  /** Porcentaje de piezas rechazadas entre las revisadas (null si aún no hay ninguna). */
  readonly rejectionRate = computed(() => {
    const total = this.passed() + this.failed();
    return total === 0 ? null : Math.round((this.failed() / total) * 100);
  });

  /** Compras por cada 100 vistas de una pieza (null si aún no hay vistas). */
  readonly conversion = computed(() => (this.views() === 0 ? null : Math.round((this.orders() / this.views()) * 1000) / 10));

  readonly empty = computed(() => this.events().length === 0 && this.audit().length === 0);

  readonly categoryBars = computed(() => toBars(this.categories(), 'amount', (m) => categoryLabel(m.label ?? m.key)));
  readonly productBars = computed(() => toBars(this.products(), 'amount', (m) => m.label ?? m.key));
  readonly sellerBars = computed(() => toBars(this.sellers(), 'amount', (m) => m.label ?? m.key));
  readonly eventBars = computed(() => toBars(this.events(), 'count', (m) => eventTypeLabel(m.key)));

  ngOnInit(): void {
    this.load();
    interval(REFRESH_SECONDS * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.autoRefresh()) this.load(true);
      });
  }

  /** silent: refresco automático, sin parpadeo de "Cargando..." ni borrar lo que ya se ve. */
  load(silent = false): void {
    if (!silent) this.loading.set(true);
    forkJoin({
      events: this.api.events(),
      categories: this.api.categories(),
      products: this.api.products(8),
      sellers: this.api.sellers(8),
      inspections: this.api.inspections(),
      audit: this.api.audit(20),
    }).subscribe({
      next: (data) => {
        this.events.set(data.events);
        this.categories.set(data.categories);
        this.products.set(data.products);
        this.sellers.set(data.sellers);
        this.inspections.set(data.inspections);
        this.audit.set(data.audit);
        this.updatedAt.set(new Date());
        this.error.set(null);
        this.loading.set(false);
      },
      error: () => {
        // En un refresco automático se conserva lo último que se vio.
        if (!silent || this.updatedAt() === null) {
          this.error.set('No se pudo cargar la analítica. Revisa que analytics-service y Kafka estén arriba.');
        }
        this.loading.set(false);
      },
    });
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.set(!this.autoRefresh());
  }

  /** Quién hizo la acción: su nombre de usuario si se conoce, si no el identificador (o "Visitante"). */
  actorOf(entry: AuditEntry): string {
    return entry.actorName ?? entry.actorId ?? 'Visitante';
  }
}
