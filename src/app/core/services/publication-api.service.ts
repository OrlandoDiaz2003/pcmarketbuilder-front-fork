import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateListingRequest, Publication } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class PublicationApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  createListing(body: CreateListingRequest): Observable<Publication> {
    // El interceptor de identidad solo agrega X-User-Role si Entra ID trae
    // app roles asignados; mientras eso no esté configurado (ver README),
    // forzamos BUYER_SELLER aquí para que el BFF/ms-user autorice la creación.
    const headers = new HttpHeaders({ 'X-User-Role': 'BUYER_SELLER' });
    return this.http.post<Publication>(`${this.baseUrl}/listings`, body, { headers });
  }
}
