import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketTableStore } from '../../core/market/market-table.store';
import type { MarketUpdate } from '../../core/models/market-update';
import { ProducerFacade } from '../../core/producer/producer.facade';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let table: MarketTableStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
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
