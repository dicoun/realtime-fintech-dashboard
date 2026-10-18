import { TestBed } from '@angular/core/testing';
import type { MarketUpdate } from '../models/market-update';
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

  it('sends applied settings to the worker and counts each update once', () => {
    const runId = facade.start(PRODUCER_SETTINGS_DEFAULTS, 11);

    expect(worker.messages[0]).toEqual({
      type: 'start',
      runId,
      settings: PRODUCER_SETTINGS_DEFAULTS,
      seed: 11,
    });

    worker.emit({ type: 'batch', runId, updates: [sampleUpdate(), sampleUpdate()] });

    expect(facade.acceptedUpdates()).toBe(2);
    expect(facade.lastBatch()).toHaveLength(2);
    expect(facade.status()).toBe('running');
  });

  it('ignores batches from an older run', () => {
    const firstRun = facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    worker.emit({ type: 'batch', runId: firstRun, updates: [sampleUpdate()] });

    const nextRun = facade.start(
      { ...PRODUCER_SETTINGS_DEFAULTS, instrumentCount: 8 },
      2,
    );
    expect(facade.acceptedUpdates()).toBe(0);

    worker.emit({ type: 'batch', runId: firstRun, updates: [sampleUpdate(), sampleUpdate()] });
    expect(facade.acceptedUpdates()).toBe(0);
    expect(facade.lastBatch()).toEqual([]);

    worker.emit({ type: 'batch', runId: nextRun, updates: [sampleUpdate()] });
    expect(facade.acceptedUpdates()).toBe(1);
    expect(facade.lastBatch()[0]?.instrument).toBe('ALFA');
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

function sampleUpdate(): MarketUpdate {
  return {
    instrument: 'ALFA',
    priceCents: 10_000,
    tradeQuantity: 1,
    bidCents: 9_999,
    askCents: 10_000,
    bidQuantity: 1,
    askQuantity: 1,
  };
}
