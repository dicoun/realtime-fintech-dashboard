import { Injectable, signal } from '@angular/core';
import type { MarketUpdate } from '../models/market-update';
import {
  applyMarketUpdates,
  createInstrumentRows,
  type InstrumentMetrics,
} from './instrument-metrics';

@Injectable({ providedIn: 'root' })
export class MarketTableStore {
  private readonly rowsState = signal<readonly InstrumentMetrics[]>([]);

  public readonly rows = this.rowsState.asReadonly();

  public reset(instrumentCount: number): void {
    this.rowsState.set(createInstrumentRows(instrumentCount));
  }

  public apply(updates: readonly MarketUpdate[]): void {
    this.rowsState.update((rows) => applyMarketUpdates(rows, updates));
  }
}
