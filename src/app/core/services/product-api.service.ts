import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, SpringPage } from '../models/catalog.models';

export interface ProductSearchParams {
  subcategoryId?: string;
  brand?: string;
  socket?: string;
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  searchProducts(params: ProductSearchParams): Observable<SpringPage<Product>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<SpringPage<Product>>(`${this.baseUrl}/products`, { params: httpParams });
  }
}
