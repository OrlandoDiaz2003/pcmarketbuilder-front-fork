import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Sale } from '../models/sale.models';

@Injectable({ providedIn: 'root' })
export class SaleApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  /** Mis ventas: las piezas que vendí y en qué etapa van (la más reciente primero). */
  mySales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.baseUrl}/sales`);
  }
}
