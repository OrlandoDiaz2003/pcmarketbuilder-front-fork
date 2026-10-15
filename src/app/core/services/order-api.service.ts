import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckoutRequest, Order } from '../models/order.models';

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  /** Compra: el comprador sale del token y el precio de la publicación, no de lo que mande el front. */
  checkout(request: CheckoutRequest): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/orders`, request);
  }

  /** Mis compras, con el estado de la revisión de cada pieza. */
  myOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders`);
  }

  /** PDF del informe técnico. Va por HttpClient (y no por un <a href>) para que lleve el Bearer token. */
  downloadReport(orderItemId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/reports/${orderItemId}`, { responseType: 'blob' });
  }
}
