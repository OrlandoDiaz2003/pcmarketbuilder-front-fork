import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditEntry, Metric } from '../models/analytics.models';

/** Analítica y auditoría: solo WORKSHOP_ADMIN (el BFF y analytics-service rechazan con 403 a cualquier otro rol). */
@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  // /insights y no /analytics: los bloqueadores de anuncios bloquean cualquier URL con "analytics" (ERR_BLOCKED_BY_CLIENT).
  private readonly baseUrl = `${environment.bffBaseUrl}/insights`;

  constructor(private readonly http: HttpClient) {}

  /** Cantidad de eventos por tipo (vistas, búsquedas, compras...). */
  events(): Observable<Metric[]> {
    return this.http.get<Metric[]>(`${this.baseUrl}/events`);
  }

  /** Ventas por categoría (subcategoría del producto), de mayor a menor monto. */
  categories(): Observable<Metric[]> {
    return this.http.get<Metric[]>(`${this.baseUrl}/categories`);
  }

  products(limit = 10): Observable<Metric[]> {
    return this.http.get<Metric[]>(`${this.baseUrl}/products`, { params: { limit } });
  }

  sellers(limit = 10): Observable<Metric[]> {
    return this.http.get<Metric[]>(`${this.baseUrl}/sellers`, { params: { limit } });
  }

  /** Resultado de las inspecciones: PASSED / FAILED. */
  inspections(): Observable<Metric[]> {
    return this.http.get<Metric[]>(`${this.baseUrl}/inspections`);
  }

  audit(limit = 20, actorId?: string): Observable<AuditEntry[]> {
    let params = new HttpParams().set('limit', limit);
    if (actorId) params = params.set('actorId', actorId);
    return this.http.get<AuditEntry[]>(`${this.baseUrl}/audit`, { params });
  }
}
