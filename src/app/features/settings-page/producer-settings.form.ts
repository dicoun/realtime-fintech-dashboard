import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  PRODUCER_SETTINGS_DEFAULTS,
  PRODUCER_SETTINGS_LIMITS,
  type ProducerSettings,
} from '../../core/models/producer-settings';

export type ProducerSettingsForm = FormGroup<{
  instrumentCount: FormControl<number | null>;
  updatesPerBatch: FormControl<number | null>;
  batchIntervalMs: FormControl<number | null>;
}>;

export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number.isInteger(value) ? null : { integer: true };
}

function settingsControl(value: number, min: number, max: number): FormControl<number | null> {
  return new FormControl<number | null>(value, {
    validators: [Validators.required, Validators.min(min), Validators.max(max), integerValidator],
  });
}

export function createProducerSettingsForm(
  initial: ProducerSettings = PRODUCER_SETTINGS_DEFAULTS,
): ProducerSettingsForm {
  return new FormGroup({
    instrumentCount: settingsControl(
      initial.instrumentCount,
      PRODUCER_SETTINGS_LIMITS.instrumentCount.min,
      PRODUCER_SETTINGS_LIMITS.instrumentCount.max,
    ),
    updatesPerBatch: settingsControl(
      initial.updatesPerBatch,
      PRODUCER_SETTINGS_LIMITS.updatesPerBatch.min,
      PRODUCER_SETTINGS_LIMITS.updatesPerBatch.max,
    ),
    batchIntervalMs: settingsControl(
      initial.batchIntervalMs,
      PRODUCER_SETTINGS_LIMITS.batchIntervalMs.min,
      PRODUCER_SETTINGS_LIMITS.batchIntervalMs.max,
    ),
  });
}

export function readProducerSettings(form: ProducerSettingsForm): ProducerSettings | null {
  if (form.invalid) {
    return null;
  }

  const value = form.getRawValue();
  if (
    value.instrumentCount === null ||
    value.updatesPerBatch === null ||
    value.batchIntervalMs === null
  ) {
    return null;
  }

  return {
    instrumentCount: value.instrumentCount,
    updatesPerBatch: value.updatesPerBatch,
    batchIntervalMs: value.batchIntervalMs,
  };
}
