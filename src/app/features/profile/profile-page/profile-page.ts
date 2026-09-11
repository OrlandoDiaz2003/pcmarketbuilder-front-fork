import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { UserApiService } from '../../../core/services/user-api.service';
import { PublicationStatus } from '../../../core/models/catalog.models';
import { UpdateProfileRequest, UserResponse } from '../../../core/models/user.models';

const ALL_STATUSES: PublicationStatus[] = ['ACTIVE', 'RESERVED', 'SOLD', 'IN_INSPECTION', 'WITHDRAWN'];

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage implements OnInit {
  readonly user = signal<UserResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  readonly publicationsCount = signal<number | null>(null);
  readonly publicationsLoading = signal(true);

  form: UpdateProfileRequest = {};

  constructor(
    private readonly userApi: UserApiService,
    private readonly catalogApi: CatalogApiService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    // Provisioning JIT: primera vez que el usuario entra tras loguearse con Entra,
    // se sincroniza (crea o actualiza) su registro en ms-user.
    this.userApi.syncUser().subscribe({
      next: () => this.loadProfile(),
      error: () => this.loadProfile(),
    });
    this.loadPublicationsCount();
  }

  private loadPublicationsCount(): void {
    // sellerId en las publicaciones es el claim "oid" de Entra (azure_oid), NO el
    // userId interno de ms-user: por eso se toma de los claims del token, no de UserResponse.
    const sellerId = this.auth.claims?.oid;
    if (!sellerId) {
      this.publicationsLoading.set(false);
      return;
    }
    forkJoin(
      ALL_STATUSES.map((status) =>
        this.catalogApi.searchListings({ sellerId, status, page: 1, limit: 1 }),
      ),
    ).subscribe({
      next: (pages) => {
        this.publicationsCount.set(pages.reduce((sum, page) => sum + page.totalElements, 0));
        this.publicationsLoading.set(false);
      },
      error: () => this.publicationsLoading.set(false),
    });
  }

  private loadProfile(): void {
    this.userApi.getMe().subscribe({
      next: (user) => {
        this.user.set(user);
        this.form = { fullName: user.fullName ?? '', bio: user.bio ?? '', address: user.address ?? '' };
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar tu perfil.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.userApi.updateMe(this.form).subscribe({
      next: (user) => {
        this.user.set(user);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => {
        this.error.set('No se pudo guardar tu perfil.');
        this.saving.set(false);
      },
    });
  }
}
