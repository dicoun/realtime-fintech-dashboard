import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import { PRODUCER_SETTINGS_DEFAULTS } from '../models/producer-settings';
import { connectProducerWorker } from './producer.worker';
import type { MarketGenerator } from './wasm-market-generator';

describe('producer worker before the session exists', () => {
  it('pauses a start that arrived before the session exists', async () => {
    const worker = createWorker();

    worker.send(start(1));
    worker.send({ type: 'pause', runId: 1 });
    await worker.finishLoading();

    expect(worker.statuses()).toEqual([
      { type: 'status', runId: 1, status: 'running' },
      { type: 'status', runId: 1, status: 'paused' },
    ]);
    expect(worker.inits).toEqual([{ instrumentCount: 5, seed: 1 }]);
  });

  it('does not pause when pause arrives before any start', async () => {
    const worker = createWorker();

    worker.send({ type: 'pause', runId: 1 });
    await worker.finishLoading();

    expect(worker.statuses()).toEqual([]);
    expect(worker.inits).toEqual([]);
  });

  it('drops the pending pause when resume arrives before the session', async () => {
    const worker = createWorker();

    worker.send(start(1));
    worker.send({ type: 'pause', runId: 1 });
    worker.send({ type: 'resume', runId: 1 });
    await worker.finishLoading();

    expect(worker.statuses()).toEqual([{ type: 'status', runId: 1, status: 'running' }]);
  });

  it('drops the pending pause when a newer start arrives', async () => {
    const worker = createWorker();

    worker.send(start(1));
    worker.send({ type: 'pause', runId: 1 });
    worker.send(start(2, 8));
    await worker.finishLoading();

    expect(worker.statuses()).toEqual([{ type: 'status', runId: 2, status: 'running' }]);
    expect(worker.inits).toEqual([{ instrumentCount: 8, seed: 1 }]);
  });
});

function createWorker() {
  const posted: ProducerEvent[] = [];
  const inits: { instrumentCount: number; seed: number }[] = [];
  let resolveLoad: (generator: MarketGenerator) => void = () => undefined;
  const loaded = new Promise<MarketGenerator>((resolve) => {
    resolveLoad = resolve;
  });
  const scope = {
    onmessage: null as ((event: MessageEvent<ProducerCommand>) => void) | null,
    postMessage(message: ProducerEvent) {
      posted.push(message);
    },
    fetch: () => Promise.reject(new Error('unused')),
  };

  connectProducerWorker(scope, () => loaded, {
    setInterval: () => ({}),
    clearInterval: () => undefined,
  });

  return {
    inits,
    send(command: ProducerCommand) {
      scope.onmessage?.({ data: command } as MessageEvent<ProducerCommand>);
    },
    statuses: () => posted.filter((event) => event.type === 'status'),
    async finishLoading(): Promise<void> {
      resolveLoad({
        init(instrumentCount, seed) {
          inits.push({ instrumentCount, seed });
        },
        nextUpdate: () => ({
          instrumentIndex: 0,
          priceCents: 100,
          tradeQuantity: 1,
          bidCents: 99,
          askCents: 100,
          bidQuantity: 1,
          askQuantity: 1,
        }),
      });
      await loaded;
    },
  };
}

function start(
  runId: number,
  instrumentCount = PRODUCER_SETTINGS_DEFAULTS.instrumentCount,
): ProducerCommand {
  return {
    type: 'start',
    runId,
    settings: { ...PRODUCER_SETTINGS_DEFAULTS, instrumentCount },
    seed: 1,
  };
}
