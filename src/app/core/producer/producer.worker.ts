import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import { ProducerSession, type ProducerClock } from './producer-session';
import { instantiateMarketGenerator, loadMarketProducerBytes } from './wasm-market-generator';

const browserClock: ProducerClock = {
  setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

interface WorkerScope {
  onmessage: ((event: MessageEvent<ProducerCommand>) => void) | null;
  postMessage(message: ProducerEvent): void;
  fetch(url: string): Promise<Response>;
}

const scope = self as unknown as WorkerScope;
let session: ProducerSession | null = null;
let pending: ProducerCommand | null = null;

function post(event: ProducerEvent): void {
  scope.postMessage(event);
  console.log('postMessage', event);
}

function handle(command: ProducerCommand): void {
  session?.start(command);
}

scope.onmessage = (event) => {
  if (!session) {
    pending = event.data;
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

void loadMarketProducerBytes((url) => scope.fetch(url))
  .then((bytes) => instantiateMarketGenerator(bytes))
  .then((generator) => {
    session = new ProducerSession(generator, post, browserClock);
    post({ type: 'ready' });
    if (!pending) {
      return;
    }
    const command = pending;
    pending = null;
    handle(command);
  })
  .catch((error: unknown) => {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to load market producer wasm',
    });
  });
