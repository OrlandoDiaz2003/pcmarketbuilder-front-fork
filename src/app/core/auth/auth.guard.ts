import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MsalGuard, MsalService } from '@azure/msal-angular';
import { AuthService } from './auth.service';

/**
 * Exige sesión: con Cognito pasa directo; con Entra se delega en MsalGuard (que espera el redirect de vuelta de
 * Microsoft). Sin ninguna sesión lleva a /login para elegir cómo entrar (antes saltaba directo a Microsoft).
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  if (auth.usesCognito) return true;

  const msalAccounts = inject(MsalService).instance.getAllAccounts();
  if (msalAccounts.length > 0 || auth.entraRedirectPending()) {
    return inject(MsalGuard).canActivate(route, state);
  }
  return inject(Router).parseUrl('/login');
};
