import {
  IPublicClientApplication,
  InteractionType,
  LogLevel,
  PublicClientApplication,
  BrowserCacheLocation,
} from '@azure/msal-browser';
import { MsalGuardConfiguration, MsalInterceptorConfiguration, ProtectedResourceScopes } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';

const { clientId, tenantId, redirectUri, postLogoutRedirectUri } = environment.msal;

/**
 * Scope de la API propia del BFF. Es lo que hace que el token salga con
 * `aud = api://<clientId>`; con scopes OIDC (openid/profile/email) el token
 * viene para Microsoft y el BFF lo rechaza al validar.
 */
const bffScope = `api://${clientId}/access_as_user`;

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
      postLogoutRedirectUri,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error(message);
              return;
            case LogLevel.Warning:
              console.warn(message);
              return;
          }
        },
      },
    },
  });
}

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: [bffScope, 'openid', 'profile', 'email'],
    },
  };
}

// Solo los endpoints que requieren identidad quedan "protegidos": MsalInterceptor
// intentará adquirir el token (y forzará login interactivo si hace falta) nada
// más que para estas rutas. El catálogo público (categorías, listings) no debe
// disparar un login.
export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string | ProtectedResourceScopes> | null>();
  protectedResourceMap.set(`${environment.bffBaseUrl}/users/me`, [bffScope]);
  protectedResourceMap.set(`${environment.bffBaseUrl}/users/sync`, [bffScope]);

  // El wildcard es necesario porque desde v5 el match es anclado y de string completo
  // (no por prefijo): sin él, `/listings` no cubriría `/listings/{publicationId}`.
  // Los scopes se acotan por método para que las mutaciones lleven el Bearer token y
  // el GET siga siendo público: si no, al fallar acquireTokenSilent MSAL dispara un
  // login interactivo y saca al visitante anónimo del catálogo.
  protectedResourceMap.set(`${environment.bffBaseUrl}/listings*`, [
    { httpMethod: 'POST', scopes: [bffScope] },
    { httpMethod: 'DELETE', scopes: [bffScope] },
    { httpMethod: 'GET', scopes: null },
  ]);

  // Compras, bandeja del taller e informes PDF: siempre con identidad, en todos los métodos.
  for (const path of ['orders', 'inspections', 'reports']) {
    protectedResourceMap.set(`${environment.bffBaseUrl}/${path}*`, [bffScope]);
  }

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}
