import type { MarketUpdate } from './market-update';
import type { ProducerSettings } from './producer-settings';

export interface ProducerCommand {
  type: 'start';
  runId: number;
  settings: ProducerSettings;
  seed: number;
}

type ProducerRuntimeStatus = 'running';

export type ProducerEvent =
  | { type: 'ready' }
  | { type: 'batch'; runId: number; updates: MarketUpdate[] }
  | { type: 'status'; runId: number; status: ProducerRuntimeStatus }
  | { type: 'error'; message: string };
