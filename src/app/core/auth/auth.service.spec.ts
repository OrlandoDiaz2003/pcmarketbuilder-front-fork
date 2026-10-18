import { TestBed } from '@angular/core/testing';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, EventType } from '@azure/msal-browser';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { UserApiService } from '../services/user-api.service';
import { AuthService } from './auth.service';

const MSAL_KEY = 'msal.interaction.status';

function account(name: string): AccountInfo {
  return { homeAccountId: name, localAccountId: name, environment: 'e', tenantId: 't', username: name + '@x.com' };
}

describe('AuthService (login / logout)', () => {
  const msalSubject$ = new Subject<unknown>();
  const instance = { getActiveAccount: vi.fn(), setActiveAccount: vi.fn(), getAllAccounts: vi.fn() };
  const msal = { instance, loginRedirect: vi.fn(), logoutRedirect: vi.fn(), acquireTokenSilent: vi.fn() };
  const userApi = { syncUser: vi.fn() };

  function setup(): AuthService {
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    instance.getActiveAccount.mockReset().mockReturnValue(null);
    instance.getAllAccounts.mockReset().mockReturnValue([]);
    instance.setActiveAccount.mockReset();
    msal.loginRedirect.mockReset().mockReturnValue(of(undefined));
    msal.logoutRedirect.mockReset().mockReturnValue(of(undefined));
    msal.acquireTokenSilent.mockReset().mockReturnValue(of({}));
    userApi.syncUser.mockReset().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: UserApiService, useValue: userApi },
        { provide: MsalService, useValue: msal },
        { provide: MsalBroadcastService, useValue: { msalSubject$, inProgress$: new Subject() } },
      ],
    });
    return TestBed.inject(AuthService);
  }

  it('el login pide el selector de cuentas y el scope del BFF', () => {
    const auth = setup();
    auth.login();
    const request = msal.loginRedirect.mock.calls[0][0];
    expect(request.prompt).toBe('select_account');
    expect(request.scopes).toContain(`api://${environment.msal.clientId}/access_as_user`);
  });

  it('un doble clic en Iniciar sesión lanza un solo redirect (dos pedidos mezclan el state)', () => {
    const auth = setup();
    msal.loginRedirect.mockReturnValue(new Subject<void>()); // el navegador aún no se va a Microsoft
    auth.login();
    auth.login();
    auth.login();
    expect(msal.loginRedirect).toHaveBeenCalledTimes(1);
    expect(auth.redirecting()).toBe(true);
  });

  it('si el redirect falla, libera los botones y NO reintenta ni borra nada (evita state_mismatch)', () => {
    const auth = setup();
    sessionStorage.setItem(MSAL_KEY, '{"type":"signin"}');
    msal.loginRedirect.mockReturnValue(throwError(() => ({ errorCode: 'interaction_in_progress' })));
    auth.login();

    expect(msal.loginRedirect).toHaveBeenCalledTimes(1);
    expect(auth.redirecting()).toBe(false);
    expect(sessionStorage.getItem(MSAL_KEY)).not.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('al cargar la página se limpia la marca vieja de MSAL', () => {
    const auth = setup();
    sessionStorage.setItem(MSAL_KEY, '{"type":"signin"}');
    auth.clearStaleInteraction();
    expect(sessionStorage.getItem(MSAL_KEY)).toBeNull();
  });

  it('el logout cierra la cuenta activa (con su logout_hint) y vuelve al sitio', () => {
    const auth = setup();
    const a = account('a');
    instance.getActiveAccount.mockReturnValue(a);
    auth.logout();
    expect(msal.logoutRedirect).toHaveBeenCalledWith({
      account: a,
      postLogoutRedirectUri: environment.msal.postLogoutRedirectUri,
    });
  });

  it('la cuenta que acaba de entrar pasa a ser la activa, incluso al cambiar de A a B', () => {
    const auth = setup();
    const b = account('b');
    instance.getAllAccounts.mockReturnValue([account('a'), b]);
    msalSubject$.next({ eventType: EventType.ACQUIRE_TOKEN_SUCCESS, payload: { account: b } });
    expect(instance.setActiveAccount).toHaveBeenCalledWith(b);
    expect(auth.account()).toBeTruthy();
  });
});

describe('AuthService (alta del usuario en ms-user)', () => {
  const msalSubject$ = new Subject<unknown>();
  const instance = { getActiveAccount: vi.fn(), setActiveAccount: vi.fn(), getAllAccounts: vi.fn() };
  const msal = { instance, loginRedirect: vi.fn(), logoutRedirect: vi.fn(), acquireTokenSilent: vi.fn() };
  const userApi = { syncUser: vi.fn() };
  const ana = account('ana');

  function setup(hasAccount = true): AuthService {
    sessionStorage.clear();
    vi.useRealTimers();
    instance.getActiveAccount.mockReset().mockReturnValue(hasAccount ? ana : null);
    instance.getAllAccounts.mockReset().mockReturnValue(hasAccount ? [ana] : []);
    instance.setActiveAccount.mockReset();
    msal.acquireTokenSilent.mockReset().mockReturnValue(of({}));
    userApi.syncUser.mockReset().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: UserApiService, useValue: userApi },
        { provide: MsalService, useValue: msal },
        { provide: MsalBroadcastService, useValue: { msalSubject$, inProgress$: new Subject() } },
      ],
    });
    return TestBed.inject(AuthService);
  }

  const login = () => msalSubject$.next({ eventType: EventType.LOGIN_SUCCESS, payload: ana });

  afterEach(() => vi.restoreAllMocks());

  it('al iniciar sesión sincroniza al usuario una sola vez por sesión', () => {
    setup();
    login();
    msalSubject$.next({ eventType: EventType.ACQUIRE_TOKEN_SUCCESS, payload: { account: ana } });
    login();
    expect(userApi.syncUser).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('pcb.userSynced')).toBe('ana');
  });

  it('pide el token en silencio con el scope del BFF antes de llamar (no depende del redirect interactivo)', () => {
    setup();
    login();
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith({
      scopes: [`api://${environment.msal.clientId}/access_as_user`],
      account: ana,
    });
  });

  it('si no hay token válido NO llama al BFF (así no se dispara un redirect sin que el usuario lo pida)', () => {
    setup();
    msal.acquireTokenSilent.mockReturnValue(throwError(() => ({ errorCode: 'interaction_required' })));
    login();
    expect(userApi.syncUser).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('pcb.userSynced')).toBeNull();
  });

  it('si la sincronización falla no marca la sesión y reintenta solo pasado el tiempo de espera', () => {
    setup();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    userApi.syncUser.mockReturnValue(throwError(() => new Error('BFF caído')));
    login();
    expect(userApi.syncUser).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('pcb.userSynced')).toBeNull();

    now.mockReturnValue(1_000_000 + 30_000); // aún en espera: no martilla
    login();
    expect(userApi.syncUser).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 61_000);
    userApi.syncUser.mockReturnValue(of({}));
    login();
    expect(userApi.syncUser).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('pcb.userSynced')).toBe('ana');
  });

  it('sin sesión no sincroniza nada', () => {
    setup(false);
    login();
    expect(userApi.syncUser).not.toHaveBeenCalled();
    expect(msal.acquireTokenSilent).not.toHaveBeenCalled();
  });
});

describe('AuthService (errores del redirect)', () => {
  it('muestra el código AADSTS que devuelve Microsoft en vez de tragárselo', () => {
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: UserApiService, useValue: { syncUser: vi.fn() } },
        { provide: MsalService, useValue: { instance: {}, loginRedirect: vi.fn(), logoutRedirect: vi.fn() } },
        { provide: MsalBroadcastService, useValue: { msalSubject$: new Subject(), inProgress$: new Subject() } },
      ],
    });
    const auth = TestBed.inject(AuthService);
    auth.reportRedirectError({ errorCode: 'access_denied', errorMessage: 'AADSTS65001: The user has not consented' });
    expect(auth.loginError()).toBe('access_denied: AADSTS65001: The user has not consented');
    auth.dismissLoginError();
    expect(auth.loginError()).toBeNull();
  });

  it('explica state_mismatch en claro', () => {
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: UserApiService, useValue: { syncUser: vi.fn() } },
        { provide: MsalService, useValue: { instance: {}, loginRedirect: vi.fn(), logoutRedirect: vi.fn() } },
        { provide: MsalBroadcastService, useValue: { msalSubject$: new Subject(), inProgress$: new Subject() } },
      ],
    });
    const auth = TestBed.inject(AuthService);
    auth.reportRedirectError({ errorCode: 'state_mismatch', errorMessage: 'See https://aka.ms/...' });
    expect(auth.loginError()).toContain('una sola vez');
  });
});
