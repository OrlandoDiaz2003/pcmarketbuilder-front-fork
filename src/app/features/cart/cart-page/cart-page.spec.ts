import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { OrderApiService } from '../../../core/services/order-api.service';
import { CartPage } from './cart-page';

describe('CartPage checkout', () => {
  const orders = { checkout: vi.fn() };
  const auth = { isAuthenticated: true, login: vi.fn() };

  function setup() {
    localStorage.clear();
    orders.checkout.mockReset();
    auth.login.mockReset();
    auth.isAuthenticated = true;
    TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        provideRouter([]),
        { provide: OrderApiService, useValue: orders },
        { provide: AuthService, useValue: auth },
      ],
    });
    const cart = TestBed.inject(CartService);
    cart.add({ publicationId: 'p1', title: 'RTX', price: 450000, primaryImage: null, sellerUsername: 'v1' });
    cart.add({ publicationId: 'p2', title: 'Ryzen', price: 150000, primaryImage: null, sellerUsername: 'v2' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const component = TestBed.createComponent(CartPage).componentInstance;
    return { component, cart, navigate };
  }

  it('no compra con un correo inválido', () => {
    const { component } = setup();
    component.email = 'no-es-correo';
    component.checkout();
    expect(orders.checkout).not.toHaveBeenCalled();
    expect(component.emailTouched()).toBe(true);
  });

  it('sin sesión manda a iniciar sesión y no llama a la API', () => {
    const { component } = setup();
    auth.isAuthenticated = false;
    component.email = 'yo@correo.cl';
    component.checkout();
    expect(auth.login).toHaveBeenCalled();
    expect(orders.checkout).not.toHaveBeenCalled();
  });

  it('compra: envía ids y correo, vacía el carrito, recuerda el correo y va a Mis compras', () => {
    const { component, cart, navigate } = setup();
    orders.checkout.mockReturnValue(of({ orderId: 'o1' }));
    component.email = '  yo@correo.cl ';
    component.checkout();

    expect(orders.checkout).toHaveBeenCalledWith({ publicationIds: ['p1', 'p2'], buyerEmail: 'yo@correo.cl' });
    expect(cart.count()).toBe(0);
    expect(localStorage.getItem('pcbuilder.notifyEmail')).toBe('yo@correo.cl');
    expect(navigate).toHaveBeenCalledWith(['/orders'], { state: { justPurchased: true } });
  });

  it('si el BFF rechaza (409) muestra el mensaje y conserva el carrito', () => {
    const { component, cart, navigate } = setup();
    orders.checkout.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'La publicación "RTX" ya no está disponible' } })),
    );
    component.email = 'yo@correo.cl';
    component.checkout();

    expect(component.error()).toBe('La publicación "RTX" ya no está disponible');
    expect(component.submitting()).toBe(false);
    expect(cart.count()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
  });
});
