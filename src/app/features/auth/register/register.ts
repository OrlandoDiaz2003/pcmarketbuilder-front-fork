import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  accepted = false;

  constructor(readonly auth: AuthService) {}

  accept(): void {
    this.accepted = true;
    this.auth.signUp();
  }
}