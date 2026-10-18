import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Inspection } from '../../../core/models/inspection.models';
import { InspectionApiService } from '../../../core/services/inspection-api.service';
import { AdminInspections } from './admin-inspections';

function inspection(id: string): Inspection {
  return {
    id, orderId: 'o-' + id, orderItemId: 'it-' + id, publicationId: null, description: 'RTX 4070 usada',
    buyerId: 'b', buyerEmail: 'comprador@correo.cl', sellerId: 's', status: 'PENDING', maintenanceDone: null,
    maintenanceDate: null, workshopNotes: null, checks: [], completedAt: null, deliveredAt: null, createdAt: '2026-10-14T12:00:00Z',
    listing: null,
  };
}

describe('AdminInspections', () => {
  const api = { listOpen: vi.fn(), listToDeliver: vi.fn(), deliver: vi.fn(), sync: vi.fn(), complete: vi.fn() };

  function setup(items = [inspection('a'), inspection('b')]) {
    api.listOpen.mockReset().mockReturnValue(of(items));
    api.complete.mockReset();
    api.listToDeliver.mockReset().mockReturnValue(of([]));
    api.deliver.mockReset();
    api.sync.mockReset();
    TestBed.configureTestingModule({
      imports: [AdminInspections],
      providers: [{ provide: InspectionApiService, useValue: api }],
    });
    const fixture = TestBed.createComponent(AdminInspections);
    fixture.detectChanges(); // ngOnInit -> carga la bandeja
    return fixture.componentInstance;
  }

  it('carga la bandeja', () => {
    const component = setup();
    expect(component.inspections().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('no envía el formulario sin el mantenimiento realizado', () => {
    const component = setup();
    component.select(component.inspections()[0]);
    component.submit();
    expect(api.complete).not.toHaveBeenCalled();
    expect(component.formError()).toBe('Describe el mantenimiento realizado.');
  });

  it('envía el formulario, ignora componentes vacíos y saca la pieza de la bandeja', () => {
    const component = setup();
    const first = component.inspections()[0];
    api.complete.mockReturnValue(of(first));
    component.select(first);
    component.form = { result: 'FAILED', maintenanceDone: ' Pines doblados ', maintenanceDate: '2026-10-14', notes: '' };
    component.checks = [
      { component: 'Socket', result: 'FAIL', note: 'pines doblados' },
      { component: '   ', result: 'OK', note: '' },
    ];
    component.submit();

    expect(api.complete).toHaveBeenCalledWith('a', {
      result: 'FAILED',
      maintenanceDone: 'Pines doblados',
      maintenanceDate: '2026-10-14',
      notes: undefined,
      checks: [{ component: 'Socket', result: 'FAIL', note: 'pines doblados' }],
    });
    expect(component.inspections().map((i) => i.id)).toEqual(['b']);
    expect(component.selectedId()).toBeNull();
    expect(component.success()).toContain('comprador@correo.cl');
  });

  it('si otra persona ya la cerró (409) muestra el error y refresca la bandeja', () => {
    const component = setup();
    component.select(component.inspections()[0]);
    component.form.maintenanceDone = 'Limpieza';
    api.complete.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'La inspeccion ya fue cerrada' } })),
    );
    component.submit();

    expect(component.formError()).toBe('La inspeccion ya fue cerrada');
    expect(api.listOpen).toHaveBeenCalledTimes(2); // carga inicial + refresco
    expect(component.submitting()).toBe(false);
  });

  it('la pestaña "Por entregar" carga las aprobadas y marcar entregada la saca de la lista', () => {
    const component = setup();
    const approved = { ...inspection('p'), status: 'PASSED' as const, completedAt: '2026-10-15T10:00:00Z' };
    api.listToDeliver.mockReturnValue(of([approved]));
    api.deliver.mockReturnValue(of({ ...approved, deliveredAt: '2026-10-16T10:00:00Z' }));

    component.setTab('deliver');
    expect(component.inspections().map((i) => i.id)).toEqual(['p']);

    component.deliver(approved);
    expect(api.deliver).toHaveBeenCalledWith('p');
    expect(component.inspections()).toEqual([]);
    expect(component.success()).toContain('entregada');
    expect(component.warnings()).toBeNull();
  });

  it('si queda un paso pendiente lo muestra y "Reintentar" lo resuelve', () => {
    const component = setup();
    const first = component.inspections()[0];
    api.complete.mockReturnValue(of({ ...first, warnings: ['No se pudo reembolsar la orden'] }));
    component.select(first);
    component.form.maintenanceDone = 'Pines doblados';
    component.submit();
    expect(component.warnings()).toEqual({ inspectionId: 'a', messages: ['No se pudo reembolsar la orden'] });

    api.sync.mockReturnValue(of({ id: 'a', status: 'FAILED', warnings: [] }));
    component.retry();
    expect(api.sync).toHaveBeenCalledWith('a');
    expect(component.warnings()).toBeNull();
    expect(component.success()).toContain('pasos pendientes');
  });
});
