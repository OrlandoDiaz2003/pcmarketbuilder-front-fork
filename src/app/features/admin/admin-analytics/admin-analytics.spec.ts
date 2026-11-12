import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuditEntry, Metric } from '../../../core/models/analytics.models';
import { AnalyticsApiService } from '../../../core/services/analytics-api.service';
import { auditLabel, categoryLabel, eventTypeLabel } from '../../../core/utils/labels';
import { AdminAnalytics } from './admin-analytics';

const metric = (key: string, count: number, amount = 0, label: string | null = key): Metric => ({ key, label, count, amount });

const events = [metric('LISTING_VIEWED', 200), metric('SEARCH_PERFORMED', 60), metric('ORDER_PAID', 10)];
const categories = [metric('c1', 7, 700000, 'Graphics Cards'), metric('c2', 3, 100000, 'RAM')];
const inspections = [metric('PASSED', 9), metric('FAILED', 3)];
const audit: AuditEntry[] = [
  { eventId: 'a1', eventType: 'PIECE_DELIVERED', source: 'bff', actorId: 'oid-1', actorName: 'ana', occurredAt: '2026-11-12T10:00:00Z', payload: null },
  { eventId: 'a2', eventType: 'LISTING_VIEWED', source: 'bff', actorId: null, actorName: null, occurredAt: '2026-11-12T10:01:00Z', payload: null },
];

describe('AdminAnalytics', () => {
  const api = { events: vi.fn(), categories: vi.fn(), products: vi.fn(), sellers: vi.fn(), inspections: vi.fn(), audit: vi.fn() };

  function setup(overrides: Partial<Record<keyof typeof api, unknown>> = {}) {
    api.events.mockReset().mockReturnValue(overrides['events'] ?? of(events));
    api.categories.mockReset().mockReturnValue(overrides['categories'] ?? of(categories));
    api.products.mockReset().mockReturnValue(of([metric('p1', 2, 500000, 'RTX 4070')]));
    api.sellers.mockReset().mockReturnValue(of([metric('s1', 5, 600000, 'ana')]));
    api.inspections.mockReset().mockReturnValue(overrides['inspections'] ?? of(inspections));
    api.audit.mockReset().mockReturnValue(overrides['audit'] ?? of(audit));
    TestBed.configureTestingModule({ imports: [AdminAnalytics], providers: [{ provide: AnalyticsApiService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminAnalytics);
    fixture.detectChanges();
    return fixture;
  }

  it('calcula el resumen: compras, ventas totales, rechazo y compras por cada 100 vistas', () => {
    const c = setup().componentInstance;
    expect(c.orders()).toBe(10);
    expect(c.revenue()).toBe(800000);
    expect(c.rejectionRate()).toBe(25); // 3 de 12 revisadas
    expect(c.conversion()).toBe(5); // 10 compras / 200 vistas
    expect(c.loading()).toBe(false);
  });

  it('sin vistas ni revisiones no divide por cero: muestra guiones', () => {
    const c = setup({ events: of([]), inspections: of([]) }).componentInstance;
    expect(c.rejectionRate()).toBeNull();
    expect(c.conversion()).toBeNull();
  });

  it('las barras son proporcionales al mayor del grupo y las categorías salen en español', () => {
    const c = setup().componentInstance;
    const bars = c.categoryBars();
    expect(bars.map((b) => b.label)).toEqual(['Tarjetas gráficas', 'Memoria RAM']);
    expect(bars.map((b) => b.percent)).toEqual([100, 14]); // 100000 / 700000
    expect(c.eventBars()[0].label).toBe('Vistas de piezas');
  });

  it('la auditoría muestra el nombre de quien actuó, o el id, o "Visitante"', () => {
    const c = setup().componentInstance;
    expect(c.actorOf(audit[0])).toBe('ana');
    expect(c.actorOf({ ...audit[0], actorName: null })).toBe('oid-1');
    expect(c.actorOf(audit[1])).toBe('Visitante');
  });

  it('si falla la carga inicial muestra el error', () => {
    const c = setup({ events: throwError(() => new Error('503')) }).componentInstance;
    expect(c.error()).toContain('No se pudo cargar la analítica');
    expect(c.loading()).toBe(false);
  });

  it('un refresco automático que falla conserva lo último que se vio y no muestra error', () => {
    const c = setup().componentInstance;
    api.events.mockReturnValue(throwError(() => new Error('503')));
    c.load(true);
    expect(c.error()).toBeNull();
    expect(c.orders()).toBe(10);
  });

  it('en pausa no se refresca sola, y "Actualizar" siempre pide los datos', () => {
    const c = setup().componentInstance;
    c.toggleAutoRefresh();
    expect(c.autoRefresh()).toBe(false);
    api.events.mockClear();
    c.load();
    expect(api.events).toHaveBeenCalledTimes(1);
  });
});

describe('etiquetas en español de la analítica', () => {
  it('traducen subcategorías, eventos y acciones, y dejan lo desconocido como llega', () => {
    expect(categoryLabel('Power Supplies')).toBe('Fuentes de poder');
    expect(categoryLabel('SIN_CATEGORIA')).toBe('Sin categoría');
    expect(categoryLabel(null)).toBe('Sin categoría');
    expect(categoryLabel('Monitors')).toBe('Monitors');
    expect(eventTypeLabel('ORDER_PAID')).toBe('Compras pagadas');
    expect(eventTypeLabel('NUEVO')).toBe('NUEVO');
    expect(auditLabel('PURCHASE_CANCELLED')).toBe('Canceló una compra');
  });
});
