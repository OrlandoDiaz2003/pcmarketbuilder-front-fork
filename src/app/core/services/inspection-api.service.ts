import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompleteInspectionRequest, Inspection } from '../models/inspection.models';

/** Solo WORKSHOP_ADMIN: el BFF y reports rechazan con 403 a cualquier otro rol. */
@Injectable({ providedIn: 'root' })
export class InspectionApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  /** Bandeja: piezas pagadas pendientes de revisión, las más antiguas primero. */
  listOpen(): Observable<Inspection[]> {
    return this.http.get<Inspection[]>(`${this.baseUrl}/inspections`);
  }

  /** Aprobadas que el taller aún no entrega, las más antiguas primero. */
  listToDeliver(): Observable<Inspection[]> {
    return this.http.get<Inspection[]>(`${this.baseUrl}/inspections`, { params: { scope: 'to-deliver' } });
  }

  /** Inspecciones cerradas con correos pendientes, no enviados o fallidos. */
  listNotifications(): Observable<Inspection[]> {
    return this.http.get<Inspection[]>(`${this.baseUrl}/inspections`, { params: { scope: 'notifications' } });
  }

  /** Cancela la compra: se reembolsa y la pieza vuelve al catálogo. Lo que no se pueda aplicar llega en `warnings`. */
  cancel(id: string): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.baseUrl}/inspections/${id}/cancel`, {});
  }

  /** Descarta el aviso de correos: la inspección sale de la pestaña Correos sin reenviar nada. */
  dismissNotifications(id: string): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.baseUrl}/inspections/${id}/dismiss-notifications`, {});
  }

  /** Reenvía los correos pendientes o fallidos de una inspección cerrada (lo ya enviado no se repite). */
  resendNotifications(id: string): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.baseUrl}/inspections/${id}/resend-notifications`, {});
  }

  /** Marca la pieza aprobada como entregada: la venta se completa y la publicación pasa a "Vendida". */
  deliver(id: string): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.baseUrl}/inspections/${id}/deliver`, {});
  }

  /** Reintenta lo que falló tras cerrar/entregar (reembolso y estado de la publicación). Idempotente. */
  sync(id: string): Observable<{ id: string; status: string; warnings: string[] }> {
    return this.http.post<{ id: string; status: string; warnings: string[] }>(`${this.baseUrl}/inspections/${id}/sync`, {});
  }

  /** Envía el formulario: dispara el correo de confirmación y la generación del PDF. */
  complete(id: string, request: CompleteInspectionRequest): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.baseUrl}/inspections/${id}/complete`, request);
  }
}
