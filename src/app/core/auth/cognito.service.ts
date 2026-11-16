import { Injectable, inject, signal } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Sesión de compradores y vendedores con Amazon Cognito (login alojado, code + PKCE).
 * El administrador sigue entrando por Entra ID (ver AuthService).
 */
@Injectable({ providedIn: 'root' })
export class CognitoAuthService {
  private readonly oidc = inject(OidcSecurityService);

  readonly authenticated = signal(false);
  readonly userData = signal<Record<string, unknown> | null>(null);

  /** Procesa la vuelta del login (?code=&state=) o restaura la sesión guardada. Se llama al iniciar la app. */
  async init(): Promise<void> {
    this.oidc.isAuthenticated$.subscribe(({ isAuthenticated }) => this.authenticated.set(isAuthenticated));
    this.oidc.userData$.subscribe(({ userData }) => this.userData.set((userData as Record<string, unknown>) ?? null));
    try {
      await firstValueFrom(this.oidc.checkAuth());
    } catch (err) {
      console.error('[auth] No se pudo completar el login con Cognito', err);
    }
  }

  /** Redirige al login alojado de Cognito (desde ahí también se puede crear la cuenta). */
  login(): void {
    this.oidc.authorize();
  }

  /** ID token: trae el correo y el nombre, que el BFF necesita para dar de alta al usuario. */
  getIdToken(): Observable<string> {
    return this.oidc.getIdToken();
  }

  /** Borra la sesión local sin redirigir (se usa al cambiar a Entra). */
  clearLocal(): void {
    this.oidc.logoffLocal();
  }

  /** Cognito no publica end_session_endpoint: el cierre de sesión se hace en su endpoint /logout. */
  logout(): void {
    this.oidc.logoffLocal();
    const { domain, clientId, postLogoutRedirectUri } = environment.cognito;
    window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
  }
}
