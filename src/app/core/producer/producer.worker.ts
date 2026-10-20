import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import { ProducerSession, type ProducerClock } from './producer-session';
import {
  instantiateMarketGenerator,
  loadMarketProducerBytes,
  type MarketGenerator,
} from './wasm-market-generator';

const browserClock: ProducerClock = {
  setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

interface WorkerScope {
  onmessage: ((event: MessageEvent<ProducerCommand>) => void) | null;
  postMessage(message: ProducerEvent): void;
  fetch(url: string): Promise<Response>;
}

export function connectProducerWorker(
  scope: WorkerScope,
  loadGenerator: () => Promise<MarketGenerator>,
  clock: ProducerClock = browserClock,
): void {
  let session: ProducerSession | null = null;
  let pendingStart: Extract<ProducerCommand, { type: 'start' }> | null = null;
  let pausePendingStart = false;

  function post(event: ProducerEvent): void {
    scope.postMessage(event);
  }

  function handle(command: ProducerCommand): void {
    if (!session) {
      return;
    }
    if (command.type === 'pause') {
      session.pause(command.runId);
      return;
    }
    if (command.type === 'resume') {
      session.resume(command.runId);
      return;
    }
    session.start(command);
  }

  scope.onmessage = (event) => {
    if (!session) {
      if (event.data.type === 'start') {
        pendingStart = event.data;
        pausePendingStart = false;
        return;
      }
      if (event.data.type === 'pause') {
        pausePendingStart = pendingStart !== null;
        return;
      }
      pausePendingStart = false;
      return;
    }
    try {
      handle(event.data);
    } catch (error) {
      post({
        type: 'error',
        message: error instanceof Error ? error.message : 'Market producer failed',
      });
    }
  };

  void loadGenerator()
    .then((generator) => {
      session = new ProducerSession(generator, post, clock);
      post({ type: 'ready' });
      const command = pendingStart;
      const shouldPause = pausePendingStart;
      pendingStart = null;
      pausePendingStart = false;
      if (!command) {
        return;
      }
      handle(command);
      if (shouldPause) {
        session.pause(command.runId);
      }
    })
    .catch((error: unknown) => {
      post({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load market producer wasm',
      });
    });
}

if (Object.prototype.toString.call(self) === '[object DedicatedWorkerGlobalScope]') {
  const scope = self as unknown as WorkerScope;
  connectProducerWorker(scope, () =>
    loadMarketProducerBytes((url) => scope.fetch(url)).then((bytes) =>
      instantiateMarketGenerator(bytes),
    ),
  );
}
