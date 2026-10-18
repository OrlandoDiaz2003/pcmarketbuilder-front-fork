import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Sale } from '../../../core/models/sale.models';
import { SaleApiService } from '../../../core/services/sale-api.service';
import { MySales } from './my-sales';

const base = {
  id: 's1', publicationId: 'p1', title: 'RTX 4070', image: null, price: 350000, buyerUsername: 'ana',
  paidAt: '2026-10-14T12:00:00Z', reviewedAt: null, deliveredAt: null, publicationStatus: 'IN_INSPECTION',
} as unknown as Sale;

describe('MySales', () => {
  const api = { mySales: vi.fn() };

  function setup(result: Observable<Sale[]>) {
    api.mySales.mockReset().mockReturnValue(result);
    TestBed.configureTestingModule({
      imports: [MySales],
      providers: [{ provide: SaleApiService, useValue: api }, provideRouter([])],
    });
    const fixture = TestBed.createComponent(MySales);
    fixture.detectChanges();
    return fixture;
  }

  it('carga las ventas del usuario', () => {
    const component = setup(of([{ ...base, stage: 'PAID' } as Sale])).componentInstance;
    expect(component.sales().length).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('muestra un error si la carga falla', () => {
    const component = setup(throwError(() => new Error('x'))).componentInstance;
    expect(component.error()).toBe('No se pudieron cargar tus ventas.');
  });

  it('marca como hechos los pasos anteriores a la etapa actual', () => {
    const component = setup(of([])).componentInstance;
    expect(component.stepState('PAID', 'IN_REVIEW')).toBe('done');
    expect(component.stepState('IN_REVIEW', 'IN_REVIEW')).toBe('current');
    expect(component.stepState('APPROVED', 'IN_REVIEW')).toBe('pending');
    expect(component.stepState('DELIVERED', 'DELIVERED')).toBe('done');
    expect(component.stepState('IN_REVIEW', 'REJECTED')).toBe('pending');
  });

  it('ofrece volver a ver la publicación solo si fue rechazada y está activa otra vez', () => {
    const component = setup(of([])).componentInstance;
    expect(component.backInCatalog({ ...base, stage: 'REJECTED', publicationStatus: 'ACTIVE' } as Sale)).toBe(true);
    expect(component.backInCatalog({ ...base, stage: 'REJECTED', publicationStatus: 'IN_INSPECTION' } as Sale)).toBe(false);
    expect(component.backInCatalog({ ...base, stage: 'PAID', publicationStatus: 'ACTIVE' } as Sale)).toBe(false);
  });
});
