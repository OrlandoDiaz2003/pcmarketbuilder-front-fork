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
  const api = {
    listOpen: vi.fn(), listToDeliver: vi.fn(), listNotifications: vi.fn(), resendNotifications: vi.fn(),
    deliver: vi.fn(), sync: vi.fn(), complete: vi.fn(), cancel: vi.fn(),
  };

  function setup(items = [inspection('a'), inspection('b')]) {
    api.listOpen.mockReset().mockReturnValue(of(items));
    api.complete.mockReset();
    api.listToDeliver.mockReset().mockReturnValue(of([]));
    api.listNotifications.mockReset().mockReturnValue(of([]));
    api.resendNotifications.mockReset();
    api.cancel.mockReset();
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

  it('la pestaña "Correos" lista las inspecciones con correos con problemas y muestra su estado', () => {
    const component = setup();
    const withProblem = {
      ...inspection('m'),
      status: 'PASSED' as const,
      notifications: {
        confirmation: { status: 'NOT_SENT' as const, error: 'El servidor de correo (SMTP) no esta configurado' },
        report: { status: 'FAILED' as const, error: 'Fallo tras varios intentos' },
      },
    };
    api.listNotifications.mockReturnValue(of([withProblem]));

    component.setTab('mail');
    expect(api.listNotifications).toHaveBeenCalled();
    expect(component.inspections().map((i) => i.id)).toEqual(['m']);
    expect(component.notificationLabel('NOT_SENT')).toBe('No enviado');
    expect(component.notificationLabel('FAILED')).toBe('Falló');
    expect(component.notificationLabel(null)).toBe('Sin dato');
  });

  it('"Reenviar correos" pide el reenvío y saca la inspección de la lista', () => {
    const component = setup();
    const item = inspection('r');
    api.listNotifications.mockReturnValue(of([item]));
    api.resendNotifications.mockReturnValue(of(item));
    component.setTab('mail');

    component.resend(item);
    expect(api.resendNotifications).toHaveBeenCalledWith('r');
    expect(component.inspections()).toEqual([]);
    expect(component.success()).toContain('reenviar los correos');
    expect(component.resendingId()).toBeNull();
  });

  it('si el reenvío falla muestra el error y deja la inspección en la lista', () => {
    const component = setup();
    const item = inspection('f');
    api.listNotifications.mockReturnValue(of([item]));
    api.resendNotifications.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'La inspeccion aun no esta cerrada' } })),
    );
    component.setTab('mail');

    component.resend(item);
    expect(component.error()).toBe('La inspeccion aun no esta cerrada');
    expect(component.inspections().length).toBe(1);
    expect(component.resendingId()).toBeNull();
  });

  it('"Cancelar compra" pide confirmación, cancela, saca la pieza de la lista y muestra los avisos', () => {
    const component = setup();
    const item = { ...inspection('c'), status: 'PASSED' as const };
    api.listNotifications.mockReturnValue(of([item]));
    api.cancel.mockReturnValue(of({ ...item, warnings: ['No se pudo reembolsar la orden'] }));
    component.setTab('mail');

    vi.stubGlobal('confirm', () => false);
    component.cancelPurchase(item);
    expect(api.cancel).not.toHaveBeenCalled(); // sin confirmar no hace nada

    vi.stubGlobal('confirm', () => true);
    component.cancelPurchase(item);
    expect(api.cancel).toHaveBeenCalledWith('c');
    expect(component.inspections()).toEqual([]);
    expect(component.success()).toContain('Compra cancelada');
    expect(component.warnings()).toEqual({ inspectionId: 'c', messages: ['No se pudo reembolsar la orden'] });
    vi.unstubAllGlobals();
  });

  it('si cancelar falla (409) muestra el error y refresca la lista', () => {
    const component = setup();
    const item = { ...inspection('d'), status: 'PASSED' as const };
    api.listToDeliver.mockReturnValue(of([item]));
    api.cancel.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'La pieza ya fue entregada' } })),
    );
    component.setTab('deliver');
    vi.stubGlobal('confirm', () => true);

    component.cancelPurchase(item);
    expect(component.error()).toBe('La pieza ya fue entregada');
    expect(component.cancellingId()).toBeNull();
    expect(api.listToDeliver).toHaveBeenCalledTimes(2); // carga + refresco
    vi.unstubAllGlobals();
  });
});
