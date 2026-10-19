import type { MarketUpdate } from '../models/market-update';
import { instrumentSymbol } from '../producer/instrument-symbol';

export interface InstrumentMetrics {
  symbol: string;
  lastPriceCents: number | null;
  bidCents: number | null;
  askCents: number | null;
  bidQuantity: number | null;
  askQuantity: number | null;
  volume: number;
  notionalCents: bigint;
}

export interface InstrumentRowView {
  symbol: string;
  lastPrice: string;
  spread: string;
  volume: string;
  vwap: string;
  imbalance: string;
}

const UNAVAILABLE = '—';
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const volumeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const ratioFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function createInstrumentRows(instrumentCount: number): InstrumentMetrics[] {
  return Array.from({ length: instrumentCount }, (_, index) => ({
    symbol: instrumentSymbol(index),
    lastPriceCents: null,
    bidCents: null,
    askCents: null,
    bidQuantity: null,
    askQuantity: null,
    volume: 0,
    notionalCents: 0n,
  }));
}

export function applyMarketUpdates(
  rows: readonly InstrumentMetrics[],
  updates: readonly MarketUpdate[],
): InstrumentMetrics[] {
  if (rows.length === 0 || updates.length === 0) {
    return [...rows];
  }

  const bySymbol = new Map(rows.map((row) => [row.symbol, { ...row }]));
  for (const update of updates) {
    const row = bySymbol.get(update.instrument);
    if (!row) {
      continue;
    }
    row.lastPriceCents = update.priceCents;
    row.bidCents = update.bidCents;
    row.askCents = update.askCents;
    row.bidQuantity = update.bidQuantity;
    row.askQuantity = update.askQuantity;
    row.volume += update.tradeQuantity;
    row.notionalCents += BigInt(update.priceCents) * BigInt(update.tradeQuantity);
  }

  return rows.map((row) => bySymbol.get(row.symbol) ?? row);
}

export function presentInstrument(row: InstrumentMetrics): InstrumentRowView {
  return {
    symbol: row.symbol,
    lastPrice: formatCents(row.lastPriceCents),
    spread: formatCents(spreadCents(row)),
    volume: volumeFormat.format(row.volume),
    vwap: formatCents(vwapCents(row)),
    imbalance: formatRatio(orderBookImbalance(row)),
  };
}

export function spreadCents(row: InstrumentMetrics): number | null {
  if (row.bidCents === null || row.askCents === null) {
    return null;
  }
  return row.askCents - row.bidCents;
}

export function vwapCents(row: InstrumentMetrics): number | null {
  if (row.volume === 0) {
    return null;
  }
  const volume = BigInt(row.volume);
  return Number((row.notionalCents + volume / 2n) / volume);
}

export function orderBookImbalance(row: InstrumentMetrics): number | null {
  if (row.bidQuantity === null || row.askQuantity === null) {
    return null;
  }
  const total = row.bidQuantity + row.askQuantity;
  if (total === 0) {
    return null;
  }
  return (row.bidQuantity - row.askQuantity) / total;
}

function formatCents(cents: number | null): string {
  if (cents === null) {
    return UNAVAILABLE;
  }
  return moneyFormat.format(cents / 100);
}

function formatRatio(value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }
  const rounded = Math.round(value * 100) / 100;
  return ratioFormat.format(rounded === 0 ? 0 : rounded);
}
