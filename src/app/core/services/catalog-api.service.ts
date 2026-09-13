import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, ListingDetail, ListingSearchParams, ListingCard, SpringPage } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`);
  }

  searchListings(params: ListingSearchParams): Observable<SpringPage<ListingCard>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<SpringPage<ListingCard>>(`${this.baseUrl}/listings`, { params: httpParams });
  }

  getListingDetail(publicationId: string): Observable<ListingDetail> {
    return this.http.get<ListingDetail>(`${this.baseUrl}/listings/${publicationId}`);
  }

  /** Solo WORKSHOP_ADMIN: el backend rechaza con 403 a cualquier otro rol. */
  deleteListing(publicationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/listings/${publicationId}`);
  }
}
