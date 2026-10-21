import { Injectable, signal } from '@angular/core';
import { createInstrumentRows, type InstrumentMetrics } from './instrument-metrics';

@Injectable({ providedIn: 'root' })
export class MarketTableStore {
  private readonly rowsState = signal<readonly InstrumentMetrics[]>([]);

  public readonly rows = this.rowsState.asReadonly();

  public reset(instrumentCount: number): void {
    this.rowsState.set(createInstrumentRows(instrumentCount));
  }

  public replace(rows: readonly InstrumentMetrics[]): void {
    this.rowsState.set(rows.map((row) => ({ ...row })));
  }
}
