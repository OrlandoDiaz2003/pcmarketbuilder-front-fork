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
    // La identidad (X-User-Id/X-User-Role) la deriva el BFF del Bearer token
    // que agrega MsalInterceptor; el cliente no la manda.
    return this.http.post<Publication>(`${this.baseUrl}/listings`, body);
  }
}
