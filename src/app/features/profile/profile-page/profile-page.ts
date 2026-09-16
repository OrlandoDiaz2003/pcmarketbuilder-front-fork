import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserApiService } from '../../../core/services/user-api.service';
import { UpdateProfileRequest, UserResponse } from '../../../core/models/user.models';
import { gradeLabel, memberSince, statusLabel } from '../../../core/utils/labels';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage implements OnInit {
  readonly user = signal<UserResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  // Todas las publicaciones del usuario (cualquier estado), resueltas por
  // ms-user contra publication-service (ver Client.PublicationClient). Se
  // muestran ordenadas de más reciente a más antigua.
  readonly allListings = computed(
    () =>
      this.user()?.publications
        .slice()
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ) ?? [],
  );

  readonly gradeLabel = gradeLabel;
  readonly memberSince = memberSince;
  readonly statusLabel = statusLabel;

  form: UpdateProfileRequest = {};

  constructor(private readonly userApi: UserApiService) {}

  ngOnInit(): void {
    // Provisioning JIT: primera vez que el usuario entra tras loguearse con Entra,
    // se sincroniza (crea o actualiza) su registro en ms-user.
    this.userApi.syncUser().subscribe({
      next: () => this.loadProfile(),
      error: () => this.loadProfile(),
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
