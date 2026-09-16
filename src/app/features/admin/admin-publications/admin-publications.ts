import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { ListingCard, PublicationStatus } from '../../../core/models/catalog.models';

const ALL_STATUSES: PublicationStatus[] = ['ACTIVE', 'RESERVED', 'SOLD', 'IN_INSPECTION', 'WITHDRAWN'];

@Component({
  selector: 'app-admin-publications',
  imports: [DecimalPipe, DatePipe, RouterLink],
  templateUrl: './admin-publications.html',
  styleUrl: './admin-publications.css',
})
export class AdminPublications implements OnInit {
  readonly listings = signal<ListingCard[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);

  constructor(private readonly catalogApi: CatalogApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin(
      ALL_STATUSES.map((status) => this.catalogApi.searchListings({ status, page: 1, limit: 50 })),
    ).subscribe({
      next: (pages) => {
        const merged = pages.flatMap((page) => page.content);
        merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        this.listings.set(merged);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las publicaciones.');
        this.loading.set(false);
      },
    });
  }

  remove(listing: ListingCard): void {
    const confirmed = confirm(`¿Eliminar "${listing.title}" de ${listing.seller?.username ?? 'vendedor desconocido'}?`);
    if (!confirmed) return;

    this.deletingId.set(listing.publicationId);
    this.catalogApi.deleteListing(listing.publicationId).subscribe({
      next: () => {
        this.listings.set(this.listings().filter((l) => l.publicationId !== listing.publicationId));
        this.deletingId.set(null);
      },
      error: () => {
        this.error.set(`No se pudo eliminar "${listing.title}".`);
        this.deletingId.set(null);
      },
    });
  }
}
