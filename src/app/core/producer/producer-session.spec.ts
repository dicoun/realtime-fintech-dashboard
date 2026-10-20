import type { InstrumentMetrics } from '../market/instrument-metrics';
import { PRODUCER_SETTINGS_DEFAULTS } from '../models/producer-settings';
import type { ProducerEvent } from '../models/producer-messages';
import { ProducerSession, UI_SNAPSHOT_INTERVAL_MS, type ProducerClock } from './producer-session';
import type { GeneratedUpdate, MarketGenerator } from './wasm-market-generator';

describe('ProducerSession', () => {
  it('emits a snapshot for each batch when the interval is slower than the ui refresh', () => {
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
    clock.fire();

    const published = snapshots(events);
    expect(published).toHaveLength(2);
    expect(published[0]).toMatchObject({ type: 'snapshot', runId: 4, acceptedUpdates: 3 });
    expect(totalVolume(published[0]?.rows ?? [])).toBe(3);
    expect(totalVolume(published[1]?.rows ?? [])).toBe(6);
  });

  it('folds held trades into the next snapshot', () => {
    const generator = fakeGenerator();
    const clock = fakeClock();
    const events: ProducerEvent[] = [];
    const session = new ProducerSession(generator, (event) => events.push(event), clock);
    const batchIntervalMs = 50;
    const updatesPerBatch = 1_000;
    const firesBeforeNextSnapshot = Math.ceil(UI_SNAPSHOT_INTERVAL_MS / batchIntervalMs);

    session.start({
      type: 'start',
      runId: 7,
      settings: { ...PRODUCER_SETTINGS_DEFAULTS, updatesPerBatch, batchIntervalMs },
      seed: 1,
    });

    for (let fire = 0; fire < firesBeforeNextSnapshot; fire += 1) {
      clock.fire();
    }

    expect(snapshots(events).map((event) => event.acceptedUpdates)).toEqual([updatesPerBatch]);

    clock.fire();

    expect(snapshots(events).map((event) => event.acceptedUpdates)).toEqual([
      updatesPerBatch,
      updatesPerBatch * (firesBeforeNextSnapshot + 1),
    ]);
    expect(totalVolume(snapshots(events).at(-1)?.rows ?? [])).toBe(
      updatesPerBatch * (firesBeforeNextSnapshot + 1),
    );
  });

  it('drops accumulated totals when a new run starts', () => {
    const generator = fakeGenerator();
    const clock = fakeClock();
    const events: ProducerEvent[] = [];
    const session = new ProducerSession(generator, (event) => events.push(event), clock);

    session.start({
      type: 'start',
      runId: 1,
      settings: { ...PRODUCER_SETTINGS_DEFAULTS, updatesPerBatch: 10, batchIntervalMs: 50 },
      seed: 1,
    });
    clock.fire();
    clock.fire();
    expect(snapshots(events).map((event) => event.acceptedUpdates)).toEqual([10]);

    session.start({
      type: 'start',
      runId: 2,
      settings: {
        ...PRODUCER_SETTINGS_DEFAULTS,
        instrumentCount: 8,
        updatesPerBatch: 10,
        batchIntervalMs: 50,
      },
      seed: 2,
    });
    clock.fire();

    const latest = snapshots(events).at(-1);
    expect(snapshots(events).map((event) => event.acceptedUpdates)).toEqual([10, 10]);
    expect(latest).toMatchObject({ runId: 2, acceptedUpdates: 10 });
    expect(latest?.rows).toHaveLength(8);
    expect(totalVolume(latest?.rows ?? [])).toBe(10);
  });

  it('pauses generation and resumes the same totals', () => {
    const generator = fakeGenerator();
    const clock = fakeClock();
    const events: ProducerEvent[] = [];
    const session = new ProducerSession(generator, (event) => events.push(event), clock);

    session.start({
      type: 'start',
      runId: 4,
      settings: { ...PRODUCER_SETTINGS_DEFAULTS, updatesPerBatch: 3, batchIntervalMs: 500 },
      seed: 1,
    });
    clock.fire();
    const updatesAfterFirstTick = generator.updates;

    session.pause(4);
    clock.fire();

    expect(events.at(-1)).toEqual({ type: 'status', runId: 4, status: 'paused' });
    expect(clock.intervalMs).toBeNull();
    expect(generator.updates).toBe(updatesAfterFirstTick);
    expect(snapshots(events)).toHaveLength(1);

    session.resume(4);
    clock.fire();

    expect(generator.inits).toBe(1);
    expect(events.at(-1)?.type).toBe('snapshot');
    expect(totalVolume(snapshots(events).at(-1)?.rows ?? [])).toBe(6);
    expect(snapshots(events).at(-1)?.runId).toBe(4);
  });

  it('ignores pause for another run', () => {
    const generator = fakeGenerator();
    const clock = fakeClock();
    const events: ProducerEvent[] = [];
    const session = new ProducerSession(generator, (event) => events.push(event), clock);

    session.start({
      type: 'start',
      runId: 4,
      settings: { ...PRODUCER_SETTINGS_DEFAULTS, updatesPerBatch: 3, batchIntervalMs: 500 },
      seed: 1,
    });
    session.pause(99);
    clock.fire();

    expect(events.some((event) => event.type === 'status' && event.status === 'paused')).toBe(false);
    expect(generator.updates).toBe(3);
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
    expect(events.filter((event) => event.type === 'snapshot')).toHaveLength(0);
  });
});

function snapshots(events: readonly ProducerEvent[]) {
  return events.filter(
    (event): event is Extract<ProducerEvent, { type: 'snapshot' }> => event.type === 'snapshot',
  );
}

function totalVolume(rows: readonly InstrumentMetrics[]): number {
  return rows.reduce((sum, row) => sum + row.volume, 0);
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
