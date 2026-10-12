import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, Injector, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, firstValueFrom, map, of, switchMap, tap } from 'rxjs';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { ProductApiService } from '../../../core/services/product-api.service';
import { PublicationApiService } from '../../../core/services/publication-api.service';
import { Category, CreateListingRequest, Grade, Product, SpringPage } from '../../../core/models/catalog.models';
import { gradeLabel } from '../../../core/utils/labels';

const EMPTY_PAGE: SpringPage<Product> = {
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

/** Espera a que el usuario termine de escribir antes de pedir productos. */
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-create-listing',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './create-listing.html',
  styleUrl: './create-listing.css',
})

export class CreateListing implements OnInit, OnDestroy {
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly searching = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedFiles = signal<File[]>([]);
  readonly filePreviews = signal<{ file: File; previewUrl: string }[]>([]);
  readonly uploadProgress = signal<string | null>(null);

  readonly grades: Grade[] = ['GRADE_A', 'GRADE_B', 'GRADE_C'];
  readonly gradeLabel = gradeLabel;

  readonly subcategoryId = signal<string | undefined>(undefined);
  readonly productQuery = signal('');

  /** True si hay algún criterio aplicado, para ofrecer limpiar la búsqueda. */
  readonly hasSearchCriteria = computed(() => !!this.subcategoryId() || this.productQuery().trim() !== '');

  /**
   * True cuando el usuario escribió el título a mano. Mientras sea false, el título
   * se autogenera desde el producto elegido; si el usuario lo edita, se respeta tal
   * cual y cambiar de producto ya no lo pisa. Se reinicia al vaciar el campo.
   */
  readonly titleTouched = signal(false);

  form: Omit<CreateListingRequest, 'productId'> = {
    title: '',
    description: '',
    price: 0,
    grade: 'GRADE_A',
    usageTimeMonths: undefined,
  };

  // Necesario para takeUntilDestroyed(): solo puede invocarse en un injection context.
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  constructor(
    private readonly catalogApi: CatalogApiService,
    private readonly productApi: ProductApiService,
    private readonly publicationApi: PublicationApiService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.catalogApi.getCategories().subscribe({ next: (categories) => this.categories.set(categories) });
    this.watchSearchCriteria();
  }

  /**
   * El listado de productos se recalcula solo: la subcategoría se aplica al instante
   * y el texto se agrupa con debounce para no pedir en cada tecla.
   * `switchMap` cancela la petición anterior si llega una nueva, así una respuesta
   * lenta nunca pisa resultados más recientes.
   */
  private watchSearchCriteria(): void {
    const subcategory$ = toObservable(this.subcategoryId, { injector: this.injector });
    const query$ = toObservable(this.productQuery, { injector: this.injector });

    combineLatest([
      subcategory$,
      // La carga inicial espera el mismo debounce; 300ms es imperceptible y evita
      // complicar el flujo con emissions manuales.
      query$.pipe(debounceTime(SEARCH_DEBOUNCE_MS)),
    ])
      .pipe(
        map(([subcategoryId, q]) => [subcategoryId, q.trim()] as const),
        distinctUntilChanged(
          (a, b) => a[0] === b[0] && a[1] === b[1],
        ),
        tap(() => {
          this.searching.set(true);
          this.error.set(null);
        }),
        switchMap(([subcategoryId, q]) =>
          this.productApi.searchProducts({ subcategoryId, q: q || undefined, page: 1, limit: 20 }).pipe(
            catchError(() => {
              this.error.set('No se pudo buscar productos.');
              return of(EMPTY_PAGE);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.products.set(page.content);
        this.searching.set(false);
      });
  }

  clearSearch(): void {
    this.subcategoryId.set(undefined);
    this.productQuery.set('');
  }

  /** Marca que el título fue editado a mano, para dejar de autogenerarlo. */
  onTitleInput(title: string): void {
    this.form.title = title;
    this.titleTouched.set(title.trim() !== '');
  }

  selectProduct(product: Product): void {
    this.selectedProduct.set(product);
    if (!this.titleTouched()) {
      this.form.title = `${product.brand} ${product.model}`;
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const newFiles = Array.from(input.files);
    const existing = this.selectedFiles();
    const updated = [...existing, ...newFiles];
    this.selectedFiles.set(updated);
    this.updatePreviews(updated);
    input.value = '';
  }

  removeFile(index: number): void {
    const updated = this.selectedFiles().filter((_, i) => i !== index);
    this.selectedFiles.set(updated);
    this.updatePreviews(updated);
  }

  private updatePreviews(files: File[]): void {
    this.filePreviews().forEach((p) => URL.revokeObjectURL(p.previewUrl));
    this.filePreviews.set(
      files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    );
  }

  ngOnDestroy(): void {
    this.filePreviews().forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }

  submit(): void {
    const product = this.selectedProduct();
    if (!product) {
      this.error.set('Elegí un producto del catálogo antes de publicar.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.uploadProgress.set('Creando publicación...');

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
        next: async (publication) => {
          const files = this.selectedFiles();
          if (files.length > 0) {
            try {
              for (let i = 0; i < files.length; i++) {
                this.uploadProgress.set(`Subiendo foto ${i + 1} de ${files.length}...`);
                const file = files[i];
                const presigned = await firstValueFrom(
                  this.publicationApi.getPresignedUrl(publication.publicationId, file.name, file.type),
                );
                await this.publicationApi.uploadImageToS3(presigned.uploadUrl, file);
                await firstValueFrom(
                  this.publicationApi.registerImage(publication.publicationId, presigned.fileUrl, i === 0),
                );
              }
            } catch (uploadErr) {
              console.error('Error al subir imágenes a S3', uploadErr);
              // La publicación fue creada, redirigimos pero logueamos
              this.router.navigate(['/listings', publication.publicationId]);
              return;
            }
          }
          this.submitting.set(false);
          this.uploadProgress.set(null);
          this.router.navigate(['/listings', publication.publicationId]);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al crear la publicación', err);
          const upstreamMessage = typeof err.error?.message === 'string' ? err.error.message : null;
          this.error.set(upstreamMessage ?? `No se pudo crear la publicación (HTTP ${err.status}).`);
          this.submitting.set(false);
          this.uploadProgress.set(null);
        },
      });
  }
}
