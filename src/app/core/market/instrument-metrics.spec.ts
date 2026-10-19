import type { MarketUpdate } from '../models/market-update';
import {
  applyMarketUpdates,
  createInstrumentRows,
  orderBookImbalance,
  presentInstrument,
  spreadCents,
  vwapCents,
} from './instrument-metrics';

describe('instrument metrics', () => {
  it('starts each instrument with zero volume and unavailable prices', () => {
    const [alfa] = createInstrumentRows(2);

    expect(alfa?.symbol).toBe('ALFA');
    expect(presentInstrument(alfa!).volume).toBe('0');
    expect(presentInstrument(alfa!).lastPrice).toBe('—');
    expect(presentInstrument(alfa!).vwap).toBe('—');
    expect(presentInstrument(alfa!).spread).toBe('—');
    expect(presentInstrument(alfa!).imbalance).toBe('—');
  });

  it('accumulates last price, volume, VWAP, spread, and imbalance', () => {
    const [row] = applyMarketUpdates(createInstrumentRows(1), [
      trade({ priceCents: 10_000, tradeQuantity: 10, bidCents: 10_196, askCents: 10_200, bidQuantity: 600, askQuantity: 400 }),
      trade({ priceCents: 10_200, tradeQuantity: 30, bidCents: 10_196, askCents: 10_200, bidQuantity: 600, askQuantity: 400 }),
    ]);

    expect(row?.lastPriceCents).toBe(10_200);
    expect(row?.volume).toBe(40);
    expect(vwapCents(row!)).toBe(10_150);
    expect(spreadCents(row!)).toBe(4);
    expect(orderBookImbalance(row!)).toBeCloseTo(0.2);

    const view = presentInstrument(row!);
    expect(view.lastPrice).toBe('$102.00');
    expect(view.volume).toBe('40');
    expect(view.vwap).toBe('$101.50');
    expect(view.spread).toBe('$0.04');
    expect(view.imbalance).toBe('0.20');
  });

  it('rounds a half-cent VWAP up and does not show a signed zero imbalance', () => {
    const [rounded] = applyMarketUpdates(createInstrumentRows(1), [
      trade({ priceCents: 10_151, tradeQuantity: 20 }),
      trade({ priceCents: 10_150, tradeQuantity: 20 }),
    ]);
    expect(vwapCents(rounded!)).toBe(10_151);
    expect(presentInstrument(rounded!).vwap).toBe('$101.51');

    const [flat] = applyMarketUpdates(createInstrumentRows(1), [
      trade({ bidQuantity: 499, askQuantity: 501 }),
    ]);
    expect(presentInstrument(flat!).imbalance).toBe('0.00');
  });

  it('keeps book quantities out of trading volume and leaves an empty book unavailable', () => {
    const [row] = applyMarketUpdates(createInstrumentRows(1), [
      trade({ bidQuantity: 0, askQuantity: 0, tradeQuantity: 2 }),
    ]);

    expect(row?.volume).toBe(2);
    expect(orderBookImbalance(row!)).toBeNull();
  });

  it('counts every trade for one instrument and ignores unknown symbols', () => {
    const rows = applyMarketUpdates(createInstrumentRows(2), [
      trade({ instrument: 'ALFA', tradeQuantity: 1, priceCents: 10_000 }),
      trade({ instrument: 'ALFA', tradeQuantity: 4, priceCents: 10_100 }),
      trade({ instrument: 'MISSING', tradeQuantity: 9, priceCents: 50_000 }),
    ]);

    expect(rows[0]?.volume).toBe(5);
    expect(rows[0]?.lastPriceCents).toBe(10_100);
    expect(rows[1]?.volume).toBe(0);
    expect(rows[1]?.symbol).toBe('BETA');
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
