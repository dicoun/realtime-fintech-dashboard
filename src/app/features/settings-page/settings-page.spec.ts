import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProducerSettingsStore } from '../../core/producer/producer-settings.store';
import { PRODUCER_SETTINGS_DEFAULTS } from '../../core/models/producer-settings';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;
  let store: ProducerSettingsStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [ProducerSettingsStore],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    store = TestBed.inject(ProducerSettingsStore);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the settings heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Producer settings');
  });

  it('disables Apply while the form is invalid', () => {
    component.form.controls.instrumentCount.setValue(0);
    fixture.detectChanges();

    const button = queryApplyButton();
    expect(component.form.invalid).toBe(true);
    expect(button.disabled).toBe(true);
    expect(store.applied()).toEqual(PRODUCER_SETTINGS_DEFAULTS);
  });

  it('applies valid settings in memory only', () => {
    const next = {
      instrumentCount: 8,
      updatesPerBatch: 250,
      batchIntervalMs: 100,
    };
    component.form.setValue(next);
    fixture.detectChanges();

    queryApplyButton().click();
    fixture.detectChanges();

    expect(store.applied()).toEqual(next);
    expect(appliedSummary()).toContain('8 instruments');
    expect(appliedSummary()).toContain('250 updates');
    expect(appliedSummary()).toContain('100 ms');
  });

  it('shows each field its own validation limits', () => {
    component.form.controls.updatesPerBatch.setValue(null);
    component.form.controls.updatesPerBatch.markAsTouched();
    component.form.controls.batchIntervalMs.setValue(49);
    component.form.controls.batchIntervalMs.markAsTouched();
    fixture.detectChanges();

    const errors = queryErrors();
    expect(errors).toContain('Enter an integer from 1 to 1000.');
    expect(errors).toContain('Batch interval (ms) must be at least 50.');
  });

  it('does not change applied settings when Apply is attempted with invalid values', () => {
    store.apply({
      instrumentCount: 12,
      updatesPerBatch: 40,
      batchIntervalMs: 750,
    });
    fixture.detectChanges();

    component.form.controls.updatesPerBatch.setValue(null);
    fixture.detectChanges();
    expect(queryError()).toBeNull();

    component.apply();
    fixture.detectChanges();

    expect(store.applied()).toEqual({
      instrumentCount: 12,
      updatesPerBatch: 40,
      batchIntervalMs: 750,
    });
    expect(queryApplyButton().disabled).toBe(true);
    expect(component.form.controls.updatesPerBatch.touched).toBe(false);
    expect(queryError()).toBeNull();
  });

  function queryApplyButton(): HTMLButtonElement {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  }

  function appliedSummary(): string {
    return (
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="applied-settings"]')
        ?.textContent ?? ''
    );
  }

  function queryError(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.error');
  }

  function queryErrors(): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('.error')].map(
      (error) => error.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }
});
