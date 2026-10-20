import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketTableStore } from '../../core/market/market-table.store';
import type { MarketUpdate } from '../../core/models/market-update';
import type { ProducerCommand, ProducerEvent } from '../../core/models/producer-messages';
import { PRODUCER_SETTINGS_DEFAULTS } from '../../core/models/producer-settings';
import {
  PRODUCER_WORKER_FACTORY,
  ProducerFacade,
  type ProducerWorkerPort,
} from '../../core/producer/producer.facade';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let table: MarketTableStore;
  let worker: FakeWorker;

  beforeEach(async () => {
    worker = new FakeWorker();
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: PRODUCER_WORKER_FACTORY, useValue: () => worker }],
    }).compileComponents();

    table = TestBed.inject(MarketTableStore);
    table.reset(5);
    fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
  });

  it('should render the dashboard heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Live market dashboard');
  });

  it('renders one row per configured instrument before the first trade', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const headers = [...compiled.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim());
    const symbols = [...compiled.querySelectorAll('tbody th')].map((cell) => cell.textContent?.trim());
    const firstRow = compiled.querySelector('tbody tr');

    expect(headers).toEqual([
      'Instrument',
      'Last traded price',
      'Bid–ask spread',
      'Trading volume',
      'VWAP',
      'Order-book imbalance',
    ]);
    expect(symbols).toEqual(['ALFA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON']);
    expect(firstRow?.textContent).toContain('—');
    expect(firstRow?.textContent).toContain('0');
  });

  it('shows a producer error instead of looking like an empty market', () => {
    TestBed.inject(ProducerFacade).errorMessage.set('Failed to load market producer wasm (404)');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('p.error') as HTMLElement;
    expect(alert.textContent).toContain('Failed to load market producer wasm (404)');
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(5);
  });

  it('pauses a running producer and resumes it', () => {
    const facade = TestBed.inject(ProducerFacade);
    const runId = facade.start(PRODUCER_SETTINGS_DEFAULTS, 1);
    worker.emit({ type: 'status', runId, status: 'running' });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;
    expect(status.textContent).toContain('Running');
    expect(button.textContent?.trim()).toBe('Pause');
    expect(button.disabled).toBe(false);

    button.click();
    worker.emit({ type: 'status', runId, status: 'paused' });
    fixture.detectChanges();

    expect(worker.messages.at(-1)).toEqual({ type: 'pause', runId });
    expect(status.textContent).toContain('Paused');
    expect(button.textContent?.trim()).toBe('Resume');

    button.click();
    expect(worker.messages.at(-1)).toEqual({ type: 'resume', runId });
  });

  it('shows cumulative trade metrics after a batch', () => {
    table.apply([
      trade({ priceCents: 10_000, tradeQuantity: 10 }),
      trade({ priceCents: 10_200, tradeQuantity: 30, bidCents: 10_196, askCents: 10_200 }),
    ]);
    fixture.detectChanges();

    const firstRow = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(firstRow.textContent).toContain('$102.00');
    expect(firstRow.textContent).toContain('$101.50');
    expect(firstRow.textContent).toContain('40');
    expect(firstRow.textContent).toContain('$0.04');
  });
});

class FakeWorker implements ProducerWorkerPort {
  public messages: ProducerCommand[] = [];
  public onmessage: ((event: MessageEvent<ProducerEvent>) => void) | null = null;

  public postMessage(message: ProducerCommand): void {
    this.messages.push(message);
  }

  public terminate(): void {
    return undefined;
  }

  public emit(event: ProducerEvent): void {
    this.onmessage?.({ data: event } as MessageEvent<ProducerEvent>);
  }
}

function trade(overrides: Partial<MarketUpdate>): MarketUpdate {
  return {
    instrument: 'ALFA',
    priceCents: 10_000,
    tradeQuantity: 1,
    bidCents: 9_999,
    askCents: 10_000,
    bidQuantity: 1,
    askQuantity: 1,
    ...overrides,
  };
}
