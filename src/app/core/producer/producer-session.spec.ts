import { PRODUCER_SETTINGS_DEFAULTS } from '../models/producer-settings';
import type { ProducerEvent } from '../models/producer-messages';
import { ProducerSession, type ProducerClock } from './producer-session';
import type { GeneratedUpdate, MarketGenerator } from './wasm-market-generator';

describe('ProducerSession', () => {
  it('emits the requested batch on the configured interval', () => {
    const generator = fakeGenerator();
    const clock = fakeClock();
    const events: ProducerEvent[] = [];
    const session = new ProducerSession(generator, (event) => events.push(event), clock);

    session.start({
      type: 'start',
      runId: 4,
      settings: { ...PRODUCER_SETTINGS_DEFAULTS, updatesPerBatch: 3, batchIntervalMs: 500 },
      seed: 9,
    });

    expect(generator.inits).toBe(1);
    expect(clock.intervalMs).toBe(500);
    clock.fire();

    const batch = events.find((event) => event.type === 'batch');
    expect(batch).toEqual({
      type: 'batch',
      runId: 4,
      updates: [market(0), market(1), market(0)],
    });
  });

  it('resets generator state when a new run starts', () => {
    const generator = fakeGenerator();
    const clock = fakeClock();
    const session = new ProducerSession(generator, () => undefined, clock);

    session.start({
      type: 'start',
      runId: 1,
      settings: PRODUCER_SETTINGS_DEFAULTS,
      seed: 1,
    });
    session.start({
      type: 'start',
      runId: 2,
      settings: PRODUCER_SETTINGS_DEFAULTS,
      seed: 2,
    });

    expect(generator.inits).toBe(2);
    expect(clock.clears).toBeGreaterThan(0);
    expect(clock.intervalMs).toBe(PRODUCER_SETTINGS_DEFAULTS.batchIntervalMs);
  });

  it('reports a generator failure and stops further ticks', () => {
    const generator = fakeGenerator();
    generator.failNext = true;
    const clock = fakeClock();
    const events: ProducerEvent[] = [];
    const session = new ProducerSession(generator, (event) => events.push(event), clock);

    session.start({
      type: 'start',
      runId: 1,
      settings: { ...PRODUCER_SETTINGS_DEFAULTS, updatesPerBatch: 1 },
      seed: 1,
    });
    clock.fire();

    expect(events.at(-1)).toEqual({
      type: 'error',
      message: 'Generator returned instrument index 99',
    });
    clock.fire();
    expect(events.filter((event) => event.type === 'batch')).toHaveLength(0);
  });
});

function market(instrumentIndex: number) {
  return {
    instrument: instrumentIndex === 0 ? 'ALFA' : 'BETA',
    priceCents: 100,
    tradeQuantity: 1,
    bidCents: 99,
    askCents: 100,
    bidQuantity: 1,
    askQuantity: 1,
  };
}

function update(instrumentIndex: number): GeneratedUpdate {
  return {
    instrumentIndex,
    priceCents: 100,
    tradeQuantity: 1,
    bidCents: 99,
    askCents: 100,
    bidQuantity: 1,
    askQuantity: 1,
  };
}

function fakeGenerator(): MarketGenerator & { inits: number; updates: number; failNext: boolean } {
  let cursor = 0;
  return {
    inits: 0,
    updates: 0,
    failNext: false,
    init() {
      this.inits += 1;
      cursor = 0;
    },
    nextUpdate() {
      this.updates += 1;
      if (this.failNext) {
        this.failNext = false;
        return { ...update(0), instrumentIndex: 99 };
      }
      const instrumentIndex = cursor % 2;
      cursor += 1;
      return update(instrumentIndex);
    },
  };
}

function fakeClock(): ProducerClock & { intervalMs: number | null; clears: number; fire(): void } {
  let handler: (() => void) | null = null;
  return {
    intervalMs: null,
    clears: 0,
    fire() {
      handler?.();
    },
    setInterval(next, intervalMs) {
      handler = next;
      this.intervalMs = intervalMs;
      return {};
    },
    clearInterval() {
      handler = null;
      this.intervalMs = null;
      this.clears += 1;
    },
  };
}
