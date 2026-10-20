import {
  applyMarketUpdates,
  createInstrumentRows,
  type InstrumentMetrics,
} from '../market/instrument-metrics';
import type { MarketUpdate } from '../models/market-update';
import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import type { ProducerSettings } from '../models/producer-settings';
import { instrumentSymbol } from './instrument-symbol';
import type { MarketGenerator } from './wasm-market-generator';

export const UI_SNAPSHOT_INTERVAL_MS = 200;

export interface ProducerClock {
  setInterval(handler: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export class ProducerSession {
  private timer: unknown = null;
  private settings: ProducerSettings | null = null;
  private runId = 0;
  private paused = false;
  private rows: InstrumentMetrics[] = [];
  private acceptedUpdates = 0;
  private elapsedMs = 0;
  private lastSnapshotMs = Number.NEGATIVE_INFINITY;

  public constructor(
    private readonly generator: MarketGenerator,
    private readonly emit: (event: ProducerEvent) => void,
    private readonly clock: ProducerClock,
  ) {}

  public start(command: Extract<ProducerCommand, { type: 'start' }>): void {
    this.clearTimer();
    this.generator.init(command.settings.instrumentCount, command.seed);
    this.settings = command.settings;
    this.runId = command.runId;
    this.paused = false;
    this.rows = createInstrumentRows(command.settings.instrumentCount);
    this.acceptedUpdates = 0;
    this.elapsedMs = 0;
    this.lastSnapshotMs = Number.NEGATIVE_INFINITY;
    this.arm();
    this.emit({ type: 'status', runId: this.runId, status: 'running' });
  }

  public pause(runId: number): void {
    if (runId !== this.runId || !this.settings || this.paused) {
      return;
    }
    this.clearTimer();
    this.paused = true;
    this.emit({ type: 'status', runId: this.runId, status: 'paused' });
  }

  public resume(runId: number): void {
    if (runId !== this.runId || !this.paused) {
      return;
    }
    this.paused = false;
    this.arm();
    this.emit({ type: 'status', runId: this.runId, status: 'running' });
  }

  private tick(): void {
    if (!this.settings) {
      return;
    }

    const updates: MarketUpdate[] = [];
    for (let index = 0; index < this.settings.updatesPerBatch; index += 1) {
      const update = this.generator.nextUpdate();
      if (update.instrumentIndex < 0 || update.instrumentIndex >= this.settings.instrumentCount) {
        throw new Error(`Generator returned instrument index ${update.instrumentIndex}`);
      }
      updates.push({
        instrument: instrumentSymbol(update.instrumentIndex),
        priceCents: update.priceCents,
        tradeQuantity: update.tradeQuantity,
        bidCents: update.bidCents,
        askCents: update.askCents,
        bidQuantity: update.bidQuantity,
        askQuantity: update.askQuantity,
      });
    }

    this.rows = applyMarketUpdates(this.rows, updates);
    this.acceptedUpdates += updates.length;
    this.elapsedMs += this.settings.batchIntervalMs;
    if (this.elapsedMs - this.lastSnapshotMs < UI_SNAPSHOT_INTERVAL_MS) {
      return;
    }
    this.lastSnapshotMs = this.elapsedMs;
    this.emit({
      type: 'snapshot',
      runId: this.runId,
      acceptedUpdates: this.acceptedUpdates,
      rows: this.rows,
    });
  }

  private arm(): void {
    if (!this.settings) {
      return;
    }
    this.clearTimer();
    const intervalMs = this.settings.batchIntervalMs;
    this.timer = this.clock.setInterval(() => {
      try {
        this.tick();
      } catch (error) {
        this.clearTimer();
        this.emit({
          type: 'error',
          message: error instanceof Error ? error.message : 'Market producer failed',
        });
      }
    }, intervalMs);
  }

  private clearTimer(): void {
    if (this.timer === null) {
      return;
    }
    this.clock.clearInterval(this.timer);
    this.timer = null;
  }
}
