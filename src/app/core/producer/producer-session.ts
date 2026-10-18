import type { MarketUpdate } from '../models/market-update';
import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import { instrumentSymbol } from './instrument-symbol';
import type { MarketGenerator } from './wasm-market-generator';

export interface ProducerClock {
  setInterval(handler: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export class ProducerSession {
  private timer: unknown = null;
  private settings: ProducerCommand['settings'] | null = null;
  private runId = 0;

  public constructor(
    private readonly generator: MarketGenerator,
    private readonly emit: (event: ProducerEvent) => void,
    private readonly clock: ProducerClock,
  ) {}

  public start(command: ProducerCommand): void {
    this.clearTimer();
    this.generator.init(command.settings.instrumentCount, command.seed);
    this.settings = command.settings;
    this.runId = command.runId;
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

    this.emit({ type: 'batch', runId: this.runId, updates });
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
