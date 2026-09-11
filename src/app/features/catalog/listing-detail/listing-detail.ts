import { DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { CartService } from '../../../core/services/cart.service';
import { ListingDetail } from '../../../core/models/catalog.models';
import { gradeLabel, statusLabel } from '../../../core/utils/labels';

@Component({
  selector: 'app-listing-detail',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './listing-detail.html',
  styleUrl: './listing-detail.css',
})
export class ListingDetailPage implements OnInit {
  readonly listing = signal<ListingDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedImageIndex = signal(0);

  readonly gradeLabel = gradeLabel;
  readonly statusLabel = statusLabel;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly catalogApi: CatalogApiService,
    readonly cart: CartService,
  ) {}

  ngOnInit(): void {
    const publicationId = this.route.snapshot.paramMap.get('id');
    if (!publicationId) {
      this.error.set('Publicación no encontrada.');
      this.loading.set(false);
      return;
    }
    this.catalogApi.getListingDetail(publicationId).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.selectedImageIndex.set(Math.max(0, listing.images.findIndex((i) => i.isPrimary)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la publicación.');
        this.loading.set(false);
      },
    });
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  addToCart(): void {
    const item = this.listing();
    if (!item) return;
    this.cart.add({
      publicationId: item.publicationId,
      title: item.title,
      price: item.price,
      primaryImage: item.images.find((i) => i.isPrimary)?.imageUrl ?? item.images[0]?.imageUrl ?? null,
      sellerUsername: item.seller?.username ?? 'Vendedor desconocido',
    });
  }
}
