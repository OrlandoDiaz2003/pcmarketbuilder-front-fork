/**
 * Al cerrar sesión, Microsoft devuelve al usuario a `postLogoutRedirectUri` agregando `?state=<estado del logout>`.
 * MSAL guarda la URL donde empieza un login (`request.origin`) y, al volver de Microsoft, la compara y navega hacia
 * ella. Si esa URL trae el `?state=` del logout, MSAL mezcla ese valor con el `state` del login y rechaza la
 * respuesta con `state_mismatch`, aunque Microsoft haya devuelto el `state` correcto (reproducido en el navegador).
 *
 * Se quita el parámetro nada más cargar la página, antes de que MSAL o el usuario inicien un login. El `state` de una
 * respuesta de login de Entra viaja en el hash (#), que no se toca.
 *
 * Excepción: la respuesta de Cognito (code + PKCE) llega en la query como `?code=…&state=…`. Ahí el `state` lo necesita
 * la librería OIDC para validar el login, así que si la URL trae `code` no se toca (el logout de Microsoft nunca lo trae).
 */
export function stripLogoutState(win: Window = window): void {
  try {
    const url = new URL(win.location.href);
    if (!url.searchParams.has('state') || url.searchParams.has('code')) return;
    url.searchParams.delete('state');
    win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // sin History API no hay nada que limpiar
  }
}
