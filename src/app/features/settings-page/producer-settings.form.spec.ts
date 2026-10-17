import {
  PRODUCER_SETTINGS_DEFAULTS,
  PRODUCER_SETTINGS_LIMITS,
} from '../../core/models/producer-settings';
import {
  createProducerSettingsForm,
  integerValidator,
  readProducerSettings,
} from './producer-settings.form';
import { FormControl } from '@angular/forms';

describe('producer settings form', () => {
  it('initializes with specification defaults', () => {
    const form = createProducerSettingsForm();

    expect(form.getRawValue()).toEqual(PRODUCER_SETTINGS_DEFAULTS);
    expect(form.valid).toBe(true);
    expect(readProducerSettings(form)).toEqual(PRODUCER_SETTINGS_DEFAULTS);
  });

  it('accepts values on the allowed boundaries', () => {
    const form = createProducerSettingsForm();

    form.setValue({
      instrumentCount: PRODUCER_SETTINGS_LIMITS.instrumentCount.max,
      updatesPerBatch: PRODUCER_SETTINGS_LIMITS.updatesPerBatch.min,
      batchIntervalMs: PRODUCER_SETTINGS_LIMITS.batchIntervalMs.max,
    });

    expect(form.valid).toBe(true);
    expect(readProducerSettings(form)).toEqual({
      instrumentCount: 50,
      updatesPerBatch: 1,
      batchIntervalMs: 2000,
    });
  });

  it('rejects a value below the minimum range', () => {
    const form = createProducerSettingsForm();
    form.controls.batchIntervalMs.setValue(PRODUCER_SETTINGS_LIMITS.batchIntervalMs.min - 1);

    expect(form.controls.batchIntervalMs.hasError('min')).toBe(true);
    expect(form.invalid).toBe(true);
    expect(readProducerSettings(form)).toBeNull();
  });

  it('rejects a value above the maximum range', () => {
    const form = createProducerSettingsForm();
    form.controls.instrumentCount.setValue(PRODUCER_SETTINGS_LIMITS.instrumentCount.max + 1);

    expect(form.controls.instrumentCount.hasError('max')).toBe(true);
    expect(form.invalid).toBe(true);
    expect(readProducerSettings(form)).toBeNull();
  });

  it('rejects an empty required field instead of coercing it to zero', () => {
    const form = createProducerSettingsForm();
    form.controls.updatesPerBatch.setValue(null);

    expect(form.controls.updatesPerBatch.hasError('required')).toBe(true);
    expect(form.controls.updatesPerBatch.value).toBeNull();
    expect(form.invalid).toBe(true);
    expect(readProducerSettings(form)).toBeNull();
  });

  it('rejects non-integer values', () => {
    const control = new FormControl<number | null>(1.5, { validators: [integerValidator] });

    expect(control.hasError('integer')).toBe(true);
    expect(integerValidator({ value: '' } as FormControl)).toBeNull();
    expect(integerValidator({ value: 10 } as FormControl)).toBeNull();
  });
});
