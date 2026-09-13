import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Corre después de MsalGuard (que ya garantiza sesión iniciada): acá solo se
 * valida el rol. La restricción real vive en el backend (publication-service
 * exige WORKSHOP_ADMIN para borrar); esto es para no mostrar la pantalla a
 * quien de todos modos va a recibir un 403.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin ? true : router.parseUrl('/');
};
