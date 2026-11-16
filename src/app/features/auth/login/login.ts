import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  constructor(readonly auth: AuthService) {}

  /** Compradores y vendedores: login alojado de Cognito. */
  signInCustomer(): void {
    this.auth.loginCognito();
  }

  /** Administradores: cuenta de Microsoft (Entra ID). */
  signInAdmin(): void {
    this.auth.login();
  }
}
