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
