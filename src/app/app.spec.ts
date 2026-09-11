import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MSAL_GUARD_CONFIG, MSAL_INSTANCE, MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { App } from './app';
import { MSALGuardConfigFactory, MSALInstanceFactory } from './core/auth/msal.factory';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: MSAL_INSTANCE, useFactory: MSALInstanceFactory },
        { provide: MSAL_GUARD_CONFIG, useFactory: MSALGuardConfigFactory },
        MsalService,
        MsalBroadcastService,
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the navbar brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('PC Builder Market');
  });
});
