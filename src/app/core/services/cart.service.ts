import { Injectable, computed, signal } from '@angular/core';
import { CartItem } from '../models/cart.models';

const STORAGE_KEY = 'pcbuilder.cart';

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Carrito solo de cliente (localStorage): no existe todavía un servicio de
 * órdenes/checkout en el backend, así que esto es una canasta de selección,
 * no un flujo de compra real.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>(loadFromStorage());

  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._items().length);
  readonly total = computed(() => this._items().reduce((sum, item) => sum + item.price, 0));

  private persist(items: CartItem[]): void {
    this._items.set(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage no disponible (modo privado, etc.): el carrito sigue funcionando en memoria.
    }
  }

  has(publicationId: string): boolean {
    return this._items().some((item) => item.publicationId === publicationId);
  }

  add(item: CartItem): void {
    if (this.has(item.publicationId)) return;
    this.persist([...this._items(), item]);
  }

  remove(publicationId: string): void {
    this.persist(this._items().filter((item) => item.publicationId !== publicationId));
  }

  clear(): void {
    this.persist([]);
  }
}
