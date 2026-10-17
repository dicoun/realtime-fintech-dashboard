import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { ProducerSettingsStore } from '../../core/producer/producer-settings.store';
import { createProducerSettingsForm, readProducerSettings } from './producer-settings.form';
import { PRODUCER_SETTINGS_LIMITS } from '../../core/models/producer-settings';

const fields = ['instrumentCount', 'updatesPerBatch', 'batchIntervalMs'] as const;
type SettingsField = (typeof fields)[number];

const FIELD_LABELS = {
  instrumentCount: 'Instrument count',
  updatesPerBatch: 'Updates per batch',
  batchIntervalMs: 'Batch interval (ms)',
} as const satisfies Record<SettingsField, string>;

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly settingsStore = inject(ProducerSettingsStore);

  protected readonly fields = fields;
  protected readonly labels = FIELD_LABELS;
  protected readonly limits = PRODUCER_SETTINGS_LIMITS;
  protected readonly applied = this.settingsStore.applied;
  public readonly form = createProducerSettingsForm(this.applied());

  protected isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected getErrorMessage(
    control: AbstractControl,
    field: SettingsField,
  ): string {
    const { min, max } = this.limits[field];
    const label = FIELD_LABELS[field];

    if (control.hasError('required')) {
      return `Enter an integer from ${min} to ${max}.`;
    }

    if (control.hasError('integer')) {
      return `${label} must be a whole number.`;
    }

    if (control.hasError('min')) {
      return `${label} must be at least ${min}.`;
    }

    if (control.hasError('max')) {
      return `${label} must be at most ${max}.`;
    }

    return 'Unexpected error';
  }

  public apply(): void {
    const settings = readProducerSettings(this.form);
    if (!settings) {
      return;
    }

    this.settingsStore.apply(settings);
  }
}

