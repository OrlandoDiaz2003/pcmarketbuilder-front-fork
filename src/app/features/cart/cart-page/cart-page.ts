import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { OrderApiService } from '../../../core/services/order-api.service';

const EMAIL_STORAGE_KEY = 'pcbuilder.notifyEmail';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadEmail(): string {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

@Component({
  selector: 'app-cart-page',
  imports: [DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.css',
})
export class CartPage {
  /** Correo donde se envía la confirmación y el informe técnico. Se recuerda para la próxima compra. */
  email = loadEmail();
  readonly emailTouched = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor(
    readonly cart: CartService,
    readonly auth: AuthService,
    private readonly orders: OrderApiService,
    private readonly router: Router,
  ) {}

  get emailValid(): boolean {
    const value = this.email.trim();
    return value.length <= 150 && EMAIL_PATTERN.test(value);
  }

  checkout(): void {
    this.emailTouched.set(true);
    if (!this.emailValid || this.submitting() || this.cart.count() === 0) return;
    if (!this.auth.isAuthenticated) {
      this.auth.login();
      return;
    }

    const buyerEmail = this.email.trim();
    this.submitting.set(true);
    this.error.set(null);
    this.orders
      .checkout({ publicationIds: this.cart.items().map((item) => item.publicationId), buyerEmail })
      .subscribe({
        next: () => {
          try {
            localStorage.setItem(EMAIL_STORAGE_KEY, buyerEmail);
          } catch {
            // sin localStorage no se recuerda el correo; la compra igual salió bien
          }
          this.cart.clear();
          this.submitting.set(false);
          void this.router.navigate(['/orders'], { state: { justPurchased: true } });
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(
            err.status === 0
              ? 'No se pudo conectar con el servidor. Intenta de nuevo en unos minutos.'
              : (err.error?.message ?? 'No se pudo completar la compra.'),
          );
          this.submitting.set(false);
        },
      });
  }
}
