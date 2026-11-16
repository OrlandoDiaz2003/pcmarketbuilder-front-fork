import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MsalInterceptor } from '@azure/msal-angular';
import { Observable, switchMap, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { CognitoAuthService } from './cognito.service';

/** Rutas del BFF que exigen identidad (mismas reglas que protectedResourceMap de MSAL). */
const ALWAYS_PROTECTED = ['users/me', 'users/sync', 'orders', 'inspections', 'reports', 'sales', 'insights'];

function needsToken(req: HttpRequest<unknown>): boolean {
  const base = environment.bffBaseUrl;
  if (!req.url.startsWith(base)) return false;
  const path = req.url.slice(base.length).replace(/^\/+/, '');
  if (ALWAYS_PROTECTED.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))) return true;
  // Catálogo: el GET es público; crear y borrar publicaciones requiere sesión.
  return path.startsWith('listings') && (req.method === 'POST' || req.method === 'DELETE');
}

/**
 * Decide qué token viaja al BFF: con sesión de Cognito, su ID token; en cualquier otro caso se delega en
 * MsalInterceptor (Entra), que además es quien fuerza el login del administrador cuando hace falta.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private readonly auth: AuthService,
    private readonly cognito: CognitoAuthService,
    private readonly msal: MsalInterceptor,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.auth.usesCognito) return this.msal.intercept(req, next);
    if (!needsToken(req)) return next.handle(req);
    return this.cognito.getIdToken().pipe(
      take(1),
      switchMap((token) => next.handle(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)),
    );
  }
}
