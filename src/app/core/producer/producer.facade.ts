import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { MarketTableStore } from '../market/market-table.store';
import type { ProducerCommand, ProducerEvent } from '../models/producer-messages';
import type { ProducerSettings } from '../models/producer-settings';

type ProducerRunStatus = 'idle' | 'starting' | 'running' | 'paused' | 'error';

export interface ProducerWorkerPort {
  postMessage(message: ProducerCommand): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<ProducerEvent>) => void) | null;
}

type ProducerWorkerFactory = () => ProducerWorkerPort;

export function createBrowserProducerWorker(): ProducerWorkerPort {
  return new Worker(new URL('./producer.worker', import.meta.url), { type: 'module' });
}

export const PRODUCER_WORKER_FACTORY = new InjectionToken<ProducerWorkerFactory>(
  'PRODUCER_WORKER_FACTORY',
  { factory: () => createBrowserProducerWorker },
);

@Injectable({ providedIn: 'root' })
export class ProducerFacade {
  private readonly workerFactory = inject(PRODUCER_WORKER_FACTORY);
  private readonly table = inject(MarketTableStore);
  private worker: ProducerWorkerPort | null = null;
  private runId = 0;

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.releaseWorker());
  }

  public readonly status = signal<ProducerRunStatus>('idle');
  public readonly errorMessage = signal<string | null>(null);
  public readonly acceptedUpdates = signal(0);

  public start(settings: ProducerSettings, seed = Date.now()): number {
    this.runId += 1;
    this.acceptedUpdates.set(0);
    this.errorMessage.set(null);
    this.status.set('starting');
    this.table.reset(settings.instrumentCount);
    this.ensureWorker().postMessage({
      type: 'start',
      runId: this.runId,
      settings,
      seed: seed >>> 0,
    });
    return this.runId;
  }

  public pause(): void {
    if (this.status() !== 'running' || !this.worker) {
      return;
    }
    this.worker.postMessage({ type: 'pause', runId: this.runId });
  }

  public resume(): void {
    if (this.status() !== 'paused' || !this.worker) {
      return;
    }
    this.worker.postMessage({ type: 'resume', runId: this.runId });
  }

  private releaseWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): ProducerWorkerPort {
    if (this.worker) {
      return this.worker;
    }
    const worker = this.workerFactory();
    worker.onmessage = (event) => this.onEvent(event.data);
    this.worker = worker;
    return worker;
  }

  private onEvent(event: ProducerEvent): void {
    if (event.type === 'error') {
      this.status.set('error');
      this.errorMessage.set(event.message);
      this.releaseWorker();
      return;
    }
    if (event.type === 'ready') {
      return;
    }
    if (event.runId !== this.runId) {
      return;
    }
    if (event.type === 'snapshot') {
      this.table.replace(event.rows);
      this.acceptedUpdates.set(event.acceptedUpdates);
      if (this.status() !== 'paused') {
        this.status.set('running');
      }
      return;
    }
    this.status.set(event.status);
  }
}
