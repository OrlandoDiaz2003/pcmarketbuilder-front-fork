import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAuth } from 'angular-auth-oidc-client';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalService,
} from '@azure/msal-angular';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { CognitoAuthService } from './core/auth/cognito.service';
import { stripLogoutState } from './core/auth/clean-url';
import { environment } from '../environments/environment';
import { MSALGuardConfigFactory, MSALInstanceFactory, MSALInterceptorConfigFactory } from './core/auth/msal.factory';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // La identidad viaja en el Bearer token: el BFF lo valida (JWKS) y deriva
    // los headers X-User-* que consumen los microservicios. Por eso ya no se
    // manda identityHeadersInterceptor: sería un puente que el cliente podría
    // falsear y además ocultaría si el token real está fallando.
    provideHttpClient(withInterceptorsFromDi()),
    // AuthInterceptor elige el token: Cognito (clientes) o, en su defecto, MsalInterceptor (Entra, administrador).
    MsalInterceptor,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideAuth({
      config: {
        authority: `https://cognito-idp.${environment.cognito.region}.amazonaws.com/${environment.cognito.userPoolId}`,
        redirectUrl: environment.cognito.redirectUri,
        postLogoutRedirectUri: environment.cognito.postLogoutRedirectUri,
        clientId: environment.cognito.clientId,
        scope: 'openid email profile',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        ignoreNonceAfterRefresh: true, // Cognito no devuelve nonce al refrescar
        renewTimeBeforeTokenExpiresInSeconds: 60,
      },
    }),
    { provide: MSAL_INSTANCE, useFactory: MSALInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useFactory: MSALGuardConfigFactory },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: MSALInterceptorConfigFactory },
    MsalService,
    MsalGuard,
    MsalBroadcastService,
    provideAppInitializer(() => {
      stripLogoutState(); // antes de MSAL: ver clean-url.ts
      const msalService = inject(MsalService);
      const auth = inject(AuthService); // fuerza la creación temprana para no perder el primer evento de login
      const cognito = inject(CognitoAuthService);
      // Si la URL trae la respuesta de Microsoft (#state=…) Cognito no tiene nada que procesar: evita que su
      // librería intente validar un state que no es suyo.
      const cognitoInit = auth.entraRedirectPending() ? Promise.resolve() : cognito.init();
      const msalInit = msalService.instance.initialize().then(() => {
        msalService.handleRedirectObservable().subscribe({ error: (err) => auth.reportRedirectError(err) });
      });
      return Promise.all([msalInit, cognitoInit]);
    }),
  ],
};
