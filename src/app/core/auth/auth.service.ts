import { Injectable, OnDestroy, signal } from '@angular/core';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, EventMessage, EventType, InteractionStatus } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { UserRole } from '../models/user.models';

export interface EntraClaims {
  oid?: string;
  roles?: string[];
  email?: string;
  preferred_username?: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly destroyed$ = new Subject<void>();

  readonly account = signal<AccountInfo | null>(null);

  constructor(
    private readonly msalService: MsalService,
    private readonly msalBroadcastService: MsalBroadcastService,
  ) {
    this.msalBroadcastService.msalSubject$
      .pipe(
        filter((msg: EventMessage) => msg.eventType === EventType.LOGIN_SUCCESS),
        takeUntil(this.destroyed$),
      )
      .subscribe(() => this.syncActiveAccount());

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
      return;
    }
    const accounts = this.msalService.instance.getAllAccounts();
    if (accounts.length > 0) {
      this.msalService.instance.setActiveAccount(accounts[0]);
      this.account.set(accounts[0]);
    } else {
      this.account.set(null);
    }
  }

  get isAuthenticated(): boolean {
    return this.account() !== null;
  }

  get claims(): EntraClaims | null {
    return (this.account()?.idTokenClaims as EntraClaims | undefined) ?? null;
  }

  /** Rol de aplicación (app role) asignado en Entra ID. Usado por ms-user al sincronizar. */
  get role(): UserRole | null {
    const roles = this.claims?.roles;
    return (roles?.[0] as UserRole) ?? null;
  }

  get displayName(): string | null {
    return this.claims?.name ?? this.account()?.username ?? null;
  }

  login(): void {
    this.msalService.loginRedirect();
  }

  logout(): void {
    this.msalService.logoutRedirect({ postLogoutRedirectUri: '/' });
  }
}
