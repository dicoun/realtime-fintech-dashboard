import type { InstrumentMetrics } from '../market/instrument-metrics';
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
  | {
      type: 'snapshot';
      runId: number;
      acceptedUpdates: number;
      rows: InstrumentMetrics[];
    }
  | { type: 'status'; runId: number; status: ProducerRuntimeStatus }
  | { type: 'error'; message: string };
