import { DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
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
  readonly deleting = signal(false);

  readonly gradeLabel = gradeLabel;
  readonly statusLabel = statusLabel;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly catalogApi: CatalogApiService,
    readonly cart: CartService,
    readonly auth: AuthService,
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

  /** True si la publicación pertenece al usuario autenticado (mismo azure_oid). */
  isOwnListing(): boolean {
    const item = this.listing();
    return !!item?.sellerId && item.sellerId === this.auth.claims?.oid;
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

  deleteListing(): void {
    const item = this.listing();
    if (!item) return;
    if (!confirm(`¿Eliminar "${item.title}"? Esta acción no se puede deshacer.`)) return;

    this.deleting.set(true);
    this.catalogApi.deleteListing(item.publicationId).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.error.set('No se pudo eliminar la publicación.');
        this.deleting.set(false);
      },
    });
  }
}
