import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { CartService } from '../../../core/services/cart.service';
import { Category, Grade, ListingCard, ListingSearchParams, SpringPage } from '../../../core/models/catalog.models';

const EMPTY_PAGE: SpringPage<ListingCard> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 20,
  number: 0,
  numberOfElements: 0,
  first: true,
  last: true,
  empty: true,
};

@Component({
  selector: 'app-catalog-list',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './catalog-list.html',
  styleUrl: './catalog-list.css',
})
export class CatalogList implements OnInit {
  readonly categories = signal<Category[]>([]);
  readonly page = signal<SpringPage<ListingCard>>(EMPTY_PAGE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageNumbers = computed(() => Array.from({ length: this.page().totalPages }, (_, i) => i + 1));

  readonly grades: Grade[] = ['GRADE_A', 'GRADE_B', 'GRADE_C'];

  filters: ListingSearchParams = { page: 1, limit: 20 };

  constructor(
    private readonly catalogApi: CatalogApiService,
    readonly cart: CartService,
  ) {}

  ngOnInit(): void {
    this.catalogApi.getCategories().subscribe({ next: (categories) => this.categories.set(categories) });
    this.search();
  }

  search(): void {
    this.loading.set(true);
    this.error.set(null);
    this.catalogApi.searchListings({ ...this.filters, page: this.filters.page ?? 1 }).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo. ¿Está el BFF corriendo en http://localhost:4000?');
        this.loading.set(false);
      },
    });
  }

  goToPage(pageNumber: number): void {
    this.filters.page = pageNumber;
    this.search();
  }

  addToCart(listing: ListingCard, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add({
      publicationId: listing.publicationId,
      title: listing.title,
      price: listing.price,
      primaryImage: listing.primaryImage,
      sellerUsername: listing.seller?.username ?? 'Vendedor desconocido',
    });
  }
}
