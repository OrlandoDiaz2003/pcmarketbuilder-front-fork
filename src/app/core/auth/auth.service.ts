import { Injectable, Injector, OnDestroy, signal } from '@angular/core';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult, EventMessage, EventType, InteractionStatus } from '@azure/msal-browser';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { UserRole } from '../models/user.models';
import { environment } from '../../../environments/environment';
import { UserApiService } from '../services/user-api.service';
import { bffScope, loginRequest } from './msal.factory';

export interface EntraClaims {
  oid?: string;
  roles?: string[];
  email?: string;
  preferred_username?: string;
  name?: string;
}

/** Clave (sessionStorage) con el oid del último usuario ya sincronizado con ms-user en esta sesión. */
const USER_SYNCED_KEY = 'pcb.userSynced';
/** Espera entre intentos de sincronizar al usuario si falló (evita repetir en cada evento de MSAL). */
const USER_SYNC_RETRY_MS = 60_000;

/** Clave (sessionStorage) donde MSAL marca que hay un login/logout por redirect en curso. */
const MSAL_INTERACTION_KEY = 'msal.interaction.status';

/** Tiempo máximo que se bloquean los botones esperando que el navegador salga hacia Microsoft. */
const REDIRECT_LOCK_MS = 15_000;

const DEFAULT_ROLE: UserRole = 'BUYER_SELLER';
const KNOWN_ROLES: UserRole[] = ['BUYER_SELLER', 'TECHNICAL_AGENT', 'WORKSHOP_ADMIN'];

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly destroyed$ = new Subject<void>();

  readonly account = signal<AccountInfo | null>(null);

  /** Motivo por el que Microsoft rechazó el login (se muestra en un aviso; antes se perdía en silencio). */
  readonly loginError = signal<string | null>(null);

  /**
   * Diagnóstico de login: en desarrollo (o con localStorage 'pcb.authDebug' = '1') registra el estado de MSAL en
   * cada paso y lo guarda en localStorage 'pcb.authDebugLog' para poder copiarlo aunque la página navegue.
   */
  private readonly debug = !environment.production || this.flag('pcb.authDebug');

  /** true desde que se pulsa login/logout hasta que el navegador se va a Microsoft: evita clics dobles. */
  readonly redirecting = signal(false);

  constructor(
    private readonly msalService: MsalService,
    private readonly msalBroadcastService: MsalBroadcastService,
    private readonly injector: Injector,
  ) {
    this.snapshot('página cargada');
    this.msalBroadcastService.msalSubject$.pipe(takeUntil(this.destroyed$)).subscribe((msg: EventMessage) => {
      const error = (msg.error as { errorCode?: string } | null)?.errorCode;
      this.snapshot(`evento ${msg.eventType}${error ? ' ERROR ' + error : ''}`);
    });

    // Volver con el botón Atrás puede restaurar la página tal cual estaba (bfcache), sin recargarla: el estado de
    // "redirigiendo" y la marca de MSAL quedarían pegados y los botones muertos.
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', (event) => {
        this.snapshot(`pageshow persisted=${event.persisted}`);
        if (event.persisted) {
          this.redirecting.set(false);
          this.clearStaleInteraction();
        }
      });
    }

    // La cuenta que acaba de iniciar sesión pasa a ser la activa. MSAL solo emite LOGIN_SUCCESS si cambia la
    // cantidad de cuentas en caché; ACQUIRE_TOKEN_SUCCESS cubre el cambio entre cuentas (A -> B).
    this.msalBroadcastService.msalSubject$
      .pipe(
        filter(
          (msg: EventMessage) =>
            msg.eventType === EventType.LOGIN_SUCCESS || msg.eventType === EventType.ACQUIRE_TOKEN_SUCCESS,
        ),
        takeUntil(this.destroyed$),
      )
      .subscribe((msg) => {
        const account =
          msg.eventType === EventType.LOGIN_SUCCESS
            ? (msg.payload as AccountInfo | null)
            : (msg.payload as AuthenticationResult | null)?.account;
        if (account) this.msalService.instance.setActiveAccount(account);
        this.syncActiveAccount();
      });

    this.msalBroadcastService.inProgress$
      .pipe(
        filter((status: InteractionStatus) => status === InteractionStatus.None),
        takeUntil(this.destroyed$),
      )
      .subscribe(() => this.syncActiveAccount());
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private syncActiveAccount(): void {
    const active = this.msalService.instance.getActiveAccount();
    if (active) {
      this.account.set(active);
      this.syncUserOnce();
      return;
    }
    const accounts = this.msalService.instance.getAllAccounts();
    if (accounts.length > 0) {
      this.msalService.instance.setActiveAccount(accounts[0]);
      this.account.set(accounts[0]);
      this.syncUserOnce();
    } else {
      this.account.set(null);
    }
  }

  private userSyncInFlight = false;
  private lastUserSyncAttempt = 0;

  /**
   * Alta del usuario en ms-user justo al iniciar sesión o registrarse (antes solo ocurría al abrir el perfil). Una vez por
   * sesión y por usuario. El BFF también lo hace en la primera petición autenticada: esto solo lo adelanta.
   *
   * Pide el token EN SILENCIO antes de llamar al BFF: si no hay token válido se omite. Así nunca dispara por su cuenta el
   * redirect interactivo del interceptor de MSAL (que podría sacar al usuario de la página sin que lo pida).
   */
  private syncUserOnce(): void {
    const account = this.account();
    const oid = this.claims?.oid ?? account?.localAccountId;
    if (!account || !oid || this.userSyncInFlight || this.isUserSynced(oid)) return;
    if (Date.now() - this.lastUserSyncAttempt < USER_SYNC_RETRY_MS) return;

    this.userSyncInFlight = true;
    this.lastUserSyncAttempt = Date.now();
    const done = () => (this.userSyncInFlight = false);
    this.msalService.acquireTokenSilent({ scopes: [bffScope], account }).subscribe({
      next: () => {
        try {
          this.injector.get(UserApiService).syncUser().subscribe({
            next: () => {
              this.markUserSynced(oid);
              done();
            },
            error: done,
          });
        } catch {
          done();
        }
      },
      error: done,
    });
  }

  private isUserSynced(oid: string): boolean {
    try {
      return sessionStorage.getItem(USER_SYNCED_KEY) === oid;
    } catch {
      return false;
    }
  }

  private markUserSynced(oid: string): void {
    try {
      sessionStorage.setItem(USER_SYNCED_KEY, oid);
    } catch {
      // sin sessionStorage se reintentará en la próxima carga; no es un error
    }
  }

  get isAuthenticated(): boolean {
    return this.account() !== null;
  }

  get claims(): EntraClaims | null {
    return (this.account()?.idTokenClaims as EntraClaims | undefined) ?? null;
  }

  /** Rol de aplicación (app role) asignado en Entra ID. Usado por ms-user al sincronizar. */
  get role(): UserRole {
    const roles = this.claims?.roles;
    const knownRole = (roles ?? []).find((r): r is UserRole =>
      (KNOWN_ROLES as string[]).includes(r),
    );
    return knownRole ?? DEFAULT_ROLE;
  }

  /** Solo WORKSHOP_ADMIN ve el menú de administración y puede eliminar publicaciones. */
  get isAdmin(): boolean {
    return this.role === 'WORKSHOP_ADMIN';
  }

  get displayName(): string | null {
    return this.claims?.name ?? this.account()?.username ?? null;
  }

  /**
   * `select_account` obliga a Microsoft a mostrar el selector de cuentas: sin él reutiliza en silencio la
   * sesión del último usuario y no hay forma de volver a entrar con la otra cuenta.
   */
  login(): void {
    this.startRedirect(() => this.msalService.loginRedirect({ ...loginRequest, prompt: 'select_account' }));
  }

  /** Registro: usa la autoridad de alta (B2C) si el tenant la define; si no,
   *  fuerza el flujo de creación de cuenta de Entra ID. Antes de llamarlo el
   *  usuario debe aceptar los Términos y Condiciones (ver página /register). */
  signUp(): void {
    const authority = environment.msal.signUpAuthority || undefined;
    this.startRedirect(() =>
      this.msalService.loginRedirect({
        scopes: ['openid', 'profile', 'email'],
        ...(authority ? { authority } : {}),
        extraQueryParameters: { prompt: 'create' },
      }),
    );
  }

  /** Cierra solo la sesión de la cuenta activa (con logout_hint, para que Microsoft no pregunte cuál cerrar). */
  logout(): void {
    const account = this.msalService.instance.getActiveAccount() ?? this.account() ?? undefined;
    this.startRedirect(() =>
      this.msalService.logoutRedirect({ account, postLogoutRedirectUri: environment.msal.postLogoutRedirectUri }),
    );
  }

  /**
   * Error al volver del redirect de Microsoft (cuenta sin acceso al tenant, consentimiento pendiente, etc.).
   * El texto de MSAL trae el código AADSTS, que es lo que permite saber qué configurar en Entra ID.
   */
  reportRedirectError(err: unknown): void {
    const e = err as { errorCode?: string; errorMessage?: string; message?: string } | null;
    console.error('[auth] Microsoft rechazó el inicio de sesión', err);
    if (e?.errorCode === 'state_mismatch') {
      this.loginError.set(
        'state_mismatch: se mezclaron dos intentos de inicio de sesión (doble clic, dos pestañas o el botón Atrás). ' +
          'Pulsa "Iniciar sesión" una sola vez y espera a que cargue Microsoft.',
      );
      return;
    }
    const detail = (e?.errorMessage || e?.message || String(err)).replace(/\s+/g, ' ').trim().slice(0, 400);
    this.loginError.set(e?.errorCode ? `${e.errorCode}: ${detail}` : detail);
  }

  dismissLoginError(): void {
    this.loginError.set(null);
  }

  /**
   * Borra la marca "hay un login/logout en curso" que MSAL deja en sessionStorage. Solo se usa al restaurar la
   * página desde el bfcache (botón Atrás): al cargar normalmente MSAL ya la limpia solo. NO se llama al pulsar el
   * botón: borrarla con un redirect en vuelo y lanzar otro deja dos pedidos con distinto `state`.
   */
  clearStaleInteraction(): void {
    try {
      sessionStorage.removeItem(MSAL_INTERACTION_KEY);
    } catch {
      // sin sessionStorage no hay marca que limpiar
    }
  }

  private flag(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  /** Una línea con todo lo que MSAL tiene guardado: permite ver qué `state` se esperaba y cuál llegó. */
  private snapshot(label: string): void {
    if (!this.debug) return;
    try {
      const stateId = (value: string | null): string => {
        try {
          return JSON.parse(atob(value ?? '')).id?.slice(-8) ?? '-';
        } catch {
          return value ? '?' : '-';
        }
      };
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith('msal'));
      const read = (suffix: string) => {
        const key = keys.find((k) => k.endsWith(suffix));
        return key ? sessionStorage.getItem(key) : null;
      };
      const params = read('request.params');
      const requestState = params ? stateId(JSON.parse(atob(params)).state) : '-';
      const hashState = new URLSearchParams(location.hash.slice(1)).get('state');
      const cachedHash = read('urlHash');
      const cachedHashState = cachedHash ? new URLSearchParams(cachedHash.replace(/^#/, '')).get('state') : null;
      const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
      const line =
        `${new Date().toISOString().slice(11, 23)} ${label} | ruta=${location.pathname} nav=${nav} ` +
        `| status=${read('interaction.status') ?? '-'} | state pedido=${requestState} ` +
        `| state en URL=${hashState ? stateId(hashState) : '-'} | state en urlHash=${stateId(cachedHashState)} ` +
        `| origen=${read('request.origin') ?? '-'} | cuentas=${this.msalService.instance.getAllAccounts?.().length ?? '?'}`;
      console.info('[auth-debug]', line);
      const log: string[] = JSON.parse(localStorage.getItem('pcb.authDebugLog') ?? '[]');
      log.push(line);
      localStorage.setItem('pcb.authDebugLog', JSON.stringify(log.slice(-80)));
    } catch {
      // el diagnóstico nunca debe romper el login
    }
  }

  /** Un solo redirect a la vez: los clics repetidos se ignoran mientras el navegador viaja a Microsoft. */
  private startRedirect(action: () => Observable<void>): void {
    if (this.redirecting()) {
      this.snapshot('clic ignorado (ya hay un redirect en curso)');
      return;
    }
    this.snapshot('antes de iniciar redirect');
    this.redirecting.set(true);
    // Red de seguridad: si la navegación nunca ocurre, los botones no pueden quedar bloqueados para siempre.
    setTimeout(() => this.redirecting.set(false), REDIRECT_LOCK_MS);
    action().subscribe({
      error: (err) => {
        this.redirecting.set(false);
        console.error('[auth] No se pudo iniciar el login/logout', err);
      },
    });
  }
}
