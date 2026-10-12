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

/** Tipos que acepta el bucket y el backend (S3Service.ALLOWED_CONTENT_TYPES). */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;

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
  /** true mientras se arrastra un archivo sobre la zona de drop. */
  readonly isDragging = signal(false);
  /** Error de validación de las fotos (tipo, tamaño o cantidad). */
  readonly photoError = signal<string | null>(null);

  readonly MAX_FILES = MAX_FILES;
  readonly MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;

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
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  // --- Drag & drop ---

  onDragOver(event: DragEvent): void {
    // Sin preventDefault el navegador abre el archivo en vez de soltarlo.
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) this.addFiles(Array.from(dropped));
  }

  /**
   * Valida y agrega archivos. Descarta los inválidos y avisa por qué, en vez de
   * fallar más tarde en el backend con un 400 que el usuario no entiende.
   */
  private addFiles(incoming: File[]): void {
    const existing = this.selectedFiles();
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        rejected.push(`${file.name} (tipo no permitido)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejected.push(`${file.name} (supera ${MAX_FILE_SIZE_MB} MB)`);
        continue;
      }
      accepted.push(file);
    }

    const updated = [...existing, ...accepted];
    const overflow = updated.length - MAX_FILES;
    if (overflow > 0) {
      rejected.push(`${overflow} foto(s) de más: el máximo es ${MAX_FILES}`);
    }

    this.selectedFiles.set(updated.slice(0, MAX_FILES));
    this.updatePreviews(updated.slice(0, MAX_FILES));
    this.photoError.set(rejected.length > 0 ? rejected.join(' · ') : null);
  }

  /** Mueve la foto de `index` al principio: el primer archivo es la portada. */
  makePrimary(index: number): void {
    const updated = [...this.selectedFiles()];
    if (index <= 0 || index >= updated.length) return;
    const [file] = updated.splice(index, 1);
    updated.unshift(file);
    this.selectedFiles.set(updated);
    this.updatePreviews(updated);
  }

  removeFile(index: number): void {
    const updated = this.selectedFiles().filter((_, i) => i !== index);
    this.selectedFiles.set(updated);
    this.updatePreviews(updated);
    if (updated.length <= MAX_FILES) this.photoError.set(null);
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
