import type { MarketUpdate } from '../models/market-update';
import { instrumentSymbol } from './instrument-symbol';
import { marketProducerWasm } from './market-producer.bytes';
import {
  instantiateMarketGenerator,
  loadMarketProducerBytes,
  type MarketGenerator,
} from './wasm-market-generator';

describe('market producer wasm', () => {
  let generator: MarketGenerator;

  beforeEach(async () => {
    expect([...marketProducerWasm.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
    generator = await instantiateMarketGenerator(marketProducerWasm);
  });

  it('generates one batch that satisfies the market invariants', () => {
    generator.init(5, 1);
    const updates = takeUpdates(generator, 100);

    expect(updates).toHaveLength(100);
    for (const update of updates) {
      expect(update.priceCents).toBeGreaterThan(0);
      expect(update.tradeQuantity).toBeGreaterThan(0);
      expect(update.bidCents).toBeGreaterThan(0);
      expect(update.askCents).toBeGreaterThan(0);
      expect(update.bidCents).toBeLessThan(update.askCents);
      expect(update.bidQuantity).toBeGreaterThanOrEqual(0);
      expect(update.askQuantity).toBeGreaterThanOrEqual(0);
      expect([update.bidCents, update.askCents]).toContain(update.priceCents);
      expect(Number.isInteger(update.priceCents)).toBe(true);
      expect(Number.isInteger(update.tradeQuantity)).toBe(true);
      expect(Number.isInteger(update.bidQuantity)).toBe(true);
      expect(Number.isInteger(update.askQuantity)).toBe(true);
    }
  });

  it('continues instrument state across batches until init resets it', () => {
    generator.init(1, 1);
    const first = takeUpdates(generator, 20);
    const second = takeUpdates(generator, 20);

    expect(second[0]).not.toEqual(first[0]);
    expect(new Set(second.map((update) => update.priceCents)).size).toBeGreaterThan(1);

    generator.init(1, 1);
    expect(takeUpdates(generator, 20)).toEqual(first);
  });

  it('keeps instruments independent', () => {
    generator.init(2, 7);
    const updates = takeUpdates(generator, 80);
    const alfa = updates.filter((update) => update.instrument === 'ALFA');
    const beta = updates.filter((update) => update.instrument === 'BETA');

    expect(alfa.length).toBeGreaterThan(0);
    expect(beta.length).toBeGreaterThan(0);
    expect(alfa[0]?.priceCents).not.toBe(beta[0]?.priceCents);
  });

  it('rejects bytes that are not a wasm module', async () => {
    await expect(instantiateMarketGenerator(new Uint8Array([0, 1, 2, 3]))).rejects.toThrow(
      'Failed to instantiate market producer wasm',
    );
  });

  it('reports a failed wasm download', async () => {
    await expect(
      loadMarketProducerBytes(async () => ({
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    ).rejects.toThrow('Failed to load market producer wasm (404)');
  });
});

function takeUpdates(generator: MarketGenerator, count: number): MarketUpdate[] {
  return Array.from({ length: count }, () => {
    const update = generator.nextUpdate();
    return {
      instrument: instrumentSymbol(update.instrumentIndex),
      priceCents: update.priceCents,
      tradeQuantity: update.tradeQuantity,
      bidCents: update.bidCents,
      askCents: update.askCents,
      bidQuantity: update.bidQuantity,
      askQuantity: update.askQuantity,
    };
  });
}
