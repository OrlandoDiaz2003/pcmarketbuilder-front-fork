import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Puente temporal mientras no existe un API Gateway que valide el JWT de Entra
 * ID y reenvíe la identidad (ver ms-user/SecurityConfig.java y AuthContext.java).
 * El BFF confía en estos headers directamente; cuando el Gateway real se
 * implemente, este interceptor deja de ser necesario y basta con el Bearer
 * token que ya agrega MsalInterceptor.
 */
export const identityHeadersInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.bffBaseUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const claims = authService.claims;
  if (!claims?.oid) {
    return next(req);
  }

  const headers: Record<string, string> = { 'X-User-Id': claims.oid };
  headers['X-User-Role'] = authService.role;
  const email = claims.email ?? claims.preferred_username;
  if (email) headers['X-User-Email'] = email;
  if (claims.name) headers['X-User-Name'] = claims.name;

  return next(req.clone({ setHeaders: headers }));
};
