import { TestBed } from '@angular/core/testing';
import { createInstrumentRows, type InstrumentMetrics } from '../market/instrument-metrics';
import { MarketTableStore } from '../market/market-table.store';
import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import { PRODUCER_SETTINGS_DEFAULTS } from '../models/producer-settings';
import {
  PRODUCER_WORKER_FACTORY,
  ProducerFacade,
  type ProducerWorkerPort,
} from './producer.facade';

describe('ProducerFacade', () => {
  let facade: ProducerFacade;
  let worker: FakeWorker;

  beforeEach(() => {
    worker = new FakeWorker();
    TestBed.configureTestingModule({
      providers: [{ provide: PRODUCER_WORKER_FACTORY, useValue: () => worker }],
    });
    facade = TestBed.inject(ProducerFacade);
  });

  it('sends applied settings to the worker and replaces the table from a snapshot', () => {
    const runId = facade.start(PRODUCER_SETTINGS_DEFAULTS, 11);

    expect(worker.messages[0]).toEqual({
      type: 'start',
      runId,
      settings: PRODUCER_SETTINGS_DEFAULTS,
      seed: 11,
    });

    worker.emit(snapshot(runId, 2, tradedRows(5, 2)));

    expect(facade.acceptedUpdates()).toBe(2);
    expect(facade.status()).toBe('running');
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(2);
  });

  it('ignores snapshots from an older run', () => {
    const firstRun = facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    worker.emit(snapshot(firstRun, 1, tradedRows(5, 1)));

    const nextRun = facade.start({ ...PRODUCER_SETTINGS_DEFAULTS, instrumentCount: 8 }, 2);
    expect(facade.acceptedUpdates()).toBe(0);

    worker.emit(snapshot(firstRun, 3, tradedRows(5, 3)));
    expect(facade.acceptedUpdates()).toBe(0);
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(0);

    worker.emit(snapshot(nextRun, 1, tradedRows(8, 1)));
    expect(facade.acceptedUpdates()).toBe(1);
    expect(TestBed.inject(MarketTableStore).rows()[0]?.symbol).toBe('ALFA');
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(1);
    expect(TestBed.inject(MarketTableStore).rows()).toHaveLength(8);
  });

  it('pauses and resumes without clearing totals', () => {
    const runId = facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    worker.emit(snapshot(runId, 4, tradedRows(5, 4)));

    facade.pause();
    expect(worker.messages.at(-1)).toEqual({ type: 'pause', runId });
    worker.emit({ type: 'status', runId, status: 'paused' });

    expect(facade.status()).toBe('paused');
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(4);

    worker.emit(snapshot(runId, 9, tradedRows(5, 9)));
    expect(facade.status()).toBe('paused');
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(9);

    facade.resume();
    expect(worker.messages.at(-1)).toEqual({ type: 'resume', runId });
    worker.emit({ type: 'status', runId, status: 'running' });
    expect(facade.status()).toBe('running');
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(9);
  });

  it('starts a new run while paused', () => {
    const runId = facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    worker.emit({ type: 'status', runId, status: 'running' });
    facade.pause();
    worker.emit({ type: 'status', runId, status: 'paused' });

    const nextRun = facade.start({ ...PRODUCER_SETTINGS_DEFAULTS, instrumentCount: 2 }, 2);

    expect(facade.status()).toBe('starting');
    expect(worker.messages.at(-1)).toMatchObject({ type: 'start', runId: nextRun });
    expect(TestBed.inject(MarketTableStore).rows()).toHaveLength(2);
    expect(TestBed.inject(MarketTableStore).rows()[0]?.volume).toBe(0);
  });

  it('ignores a pause status from an older run', () => {
    const firstRun = facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    const nextRun = facade.start(PRODUCER_SETTINGS_DEFAULTS, 2);

    worker.emit({ type: 'status', runId: firstRun, status: 'paused' });
    expect(facade.status()).toBe('starting');

    worker.emit({ type: 'status', runId: nextRun, status: 'running' });
    expect(facade.status()).toBe('running');
  });

  it('surfaces wasm load errors and terminates the worker', () => {
    facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    worker.emit({ type: 'error', message: 'Failed to load market producer wasm (404)' });

    expect(facade.status()).toBe('error');
    expect(facade.errorMessage()).toBe('Failed to load market producer wasm (404)');
    expect(worker.terminated).toBe(true);
  });

  it('starts the next run on a new worker after the previous worker failed', () => {
    const created: FakeWorker[] = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PRODUCER_WORKER_FACTORY,
          useValue: () => {
            const next = new FakeWorker();
            created.push(next);
            return next;
          },
        },
      ],
    });
    const nextFacade = TestBed.inject(ProducerFacade);

    nextFacade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    created[0]?.emit({ type: 'error', message: 'Failed to load market producer wasm (404)' });
    nextFacade.start(PRODUCER_SETTINGS_DEFAULTS, 2);

    expect(created).toHaveLength(2);
    expect(created[1]?.terminated).toBe(false);
    expect(created[1]?.messages[0]).toMatchObject({ type: 'start', seed: 2 });
  });
});

class FakeWorker implements ProducerWorkerPort {
  public messages: ProducerCommand[] = [];
  public terminated = false;
  public onmessage: ((event: MessageEvent<ProducerEvent>) => void) | null = null;

  public postMessage(message: ProducerCommand): void {
    this.messages.push(message);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public emit(event: ProducerEvent): void {
    this.onmessage?.({ data: event } as MessageEvent<ProducerEvent>);
  }
}

function snapshot(
  runId: number,
  acceptedUpdates: number,
  rows: InstrumentMetrics[],
): ProducerEvent {
  return { type: 'snapshot', runId, acceptedUpdates, rows };
}

function tradedRows(instrumentCount: number, volume: number): InstrumentMetrics[] {
  const rows = createInstrumentRows(instrumentCount);
  rows[0] = { ...rows[0], volume, lastPriceCents: 10_000 };
  return rows;
}
