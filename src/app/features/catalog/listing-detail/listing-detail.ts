import { DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { CartService } from '../../../core/services/cart.service';
import { ListingDetail } from '../../../core/models/catalog.models';

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
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la publicación.');
        this.loading.set(false);
      },
    });
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
