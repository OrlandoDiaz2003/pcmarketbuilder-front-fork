import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateListingRequest, Publication } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class PublicationApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  createListing(body: CreateListingRequest): Observable<Publication> {
    // X-User-Id/X-User-Role los agrega identityHeadersInterceptor con el rol
    // real de los claims de Entra ID (ya configurados los 3 app roles).
    return this.http.post<Publication>(`${this.baseUrl}/listings`, body);
  }
}
