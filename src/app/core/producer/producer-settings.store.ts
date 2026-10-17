import { Injectable, signal } from '@angular/core';
import { PRODUCER_SETTINGS_DEFAULTS, type ProducerSettings } from '../models/producer-settings';

@Injectable({ providedIn: 'root' })
export class ProducerSettingsStore {
  public readonly applied = signal<ProducerSettings>({ ...PRODUCER_SETTINGS_DEFAULTS });

  public apply(settings: ProducerSettings): void {
    this.applied.set({ ...settings });
  }
}
