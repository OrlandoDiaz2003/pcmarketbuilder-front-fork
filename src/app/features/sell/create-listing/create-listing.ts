import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { ProductApiService } from '../../../core/services/product-api.service';
import { PublicationApiService } from '../../../core/services/publication-api.service';
import { Category, CreateListingRequest, Grade, Product } from '../../../core/models/catalog.models';
import { gradeLabel } from '../../../core/utils/labels';

@Component({
  selector: 'app-create-listing',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './create-listing.html',
  styleUrl: './create-listing.css',
})

export class CreateListing implements OnInit {
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly searching = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly grades: Grade[] = ['GRADE_A', 'GRADE_B', 'GRADE_C'];
  readonly gradeLabel = gradeLabel;

  subcategoryId?: string;
  productQuery = '';

  form: Omit<CreateListingRequest, 'productId'> = {
    title: '',
    description: '',
    price: 0,
    grade: 'GRADE_A',
    usageTimeMonths: undefined,
  };

  constructor(
    private readonly catalogApi: CatalogApiService,
    private readonly productApi: ProductApiService,
    private readonly publicationApi: PublicationApiService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.catalogApi.getCategories().subscribe({ next: (categories) => this.categories.set(categories) });
    this.searchProducts();
  }

  searchProducts(): void {
    this.searching.set(true);
    this.productApi
      .searchProducts({ subcategoryId: this.subcategoryId, q: this.productQuery, page: 1, limit: 20 })
      .subscribe({
        next: (page) => {
          this.products.set(page.content);
          this.searching.set(false);
        },
        error: () => {
          this.error.set('No se pudo buscar productos.');
          this.searching.set(false);
        },
      });
  }

  selectProduct(product: Product): void {
    this.selectedProduct.set(product);
    if (!this.form.title) {
      this.form.title = `${product.brand} ${product.model}`;
    }
  }

  submit(): void {
    const product = this.selectedProduct();
    if (!product) {
      this.error.set('Elegí un producto del catálogo antes de publicar.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.publicationApi
      .createListing({
        productId: product.productId,
        title: this.form.title,
        description: this.form.description || undefined,
        price: this.form.price,
        grade: this.form.grade,
        usageTimeMonths: this.form.usageTimeMonths || undefined,
      })
      .subscribe({
        next: (publication) => {
          this.submitting.set(false);
          this.router.navigate(['/listings', publication.publicationId]);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al crear la publicación', err);
          const upstreamMessage = typeof err.error?.message === 'string' ? err.error.message : null;
          this.error.set(upstreamMessage ?? `No se pudo crear la publicación (HTTP ${err.status}).`);
          this.submitting.set(false);
        },
      });
  }
}
