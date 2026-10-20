import type { InstrumentMetrics } from '../market/instrument-metrics';
import type { ProducerSettings } from './producer-settings';

export type ProducerCommand =
  | {
      type: 'start';
      runId: number;
      settings: ProducerSettings;
      seed: number;
    }
  | { type: 'pause'; runId: number }
  | { type: 'resume'; runId: number };

type ProducerRuntimeStatus = 'running' | 'paused';

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
