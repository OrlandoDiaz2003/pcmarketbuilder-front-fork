import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { ListingDetail, PublicationStatus } from '../../../core/models/catalog.models';
import { CartService } from '../../../core/services/cart.service';
import { CatalogApiService } from '../../../core/services/catalog-api.service';
import { ListingDetailPage } from './listing-detail';

function listing(status: PublicationStatus): ListingDetail {
  return {
    publicationId: 'p1', title: 'RTX 4070', price: 350000, status, sellerId: 's1', images: [], seller: null,
  } as unknown as ListingDetail;
}

describe('ListingDetailPage', () => {
  function setup(status: PublicationStatus) {
    TestBed.configureTestingModule({
      imports: [ListingDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'p1' } } } },
        { provide: CatalogApiService, useValue: { getListingDetail: vi.fn().mockReturnValue(of(listing(status))) } },
        { provide: AuthService, useValue: { claims: { oid: 'otro' }, isAdmin: false, isAuthenticated: true } },
      ],
    });
    const fixture = TestBed.createComponent(ListingDetailPage);
    fixture.detectChanges();
    return fixture;
  }

  it('una publicación ACTIVE se puede agregar al carrito', () => {
    const fixture = setup('ACTIVE');
    expect(fixture.componentInstance.isAvailable()).toBe(true);
    fixture.componentInstance.addToCart();
    expect(TestBed.inject(CartService).has('p1')).toBe(true);
  });

  it.each<PublicationStatus>(['IN_INSPECTION', 'SOLD', 'WITHDRAWN', 'RESERVED'])(
    'una publicación %s no se puede agregar al carrito y el botón dice "No disponible"',
    (status) => {
      localStorage.clear();
      const fixture = setup(status);
      const component = fixture.componentInstance;
      expect(component.isAvailable()).toBe(false);
      component.addToCart();
      expect(TestBed.inject(CartService).has('p1')).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No disponible');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Agregar al carrito');
    },
  );
});
