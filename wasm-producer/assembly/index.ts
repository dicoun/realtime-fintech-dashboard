const MAX_INSTRUMENTS: i32 = 50;
const MID_OFFSET: i32 = 0;

let instrumentCount: i32 = 0;
let rng: u32 = 1;

let instrumentIndex: i32 = 0;
let priceCents: i32 = 0;
let tradeQuantity: i32 = 0;
let bidCents: i32 = 0;
let askCents: i32 = 0;
let bidQuantity: i32 = 0;
let askQuantity: i32 = 0;

function nextRandom(): u32 {
  if (rng == 0) {
    rng = 1;
  }
  rng ^= rng << 13;
  rng ^= rng >> 17;
  rng ^= rng << 5;
  return rng;
}

function below(limit: i32): i32 {
  return <i32>(nextRandom() % <u32>limit);
}

function midAddress(index: i32): i32 {
  return MID_OFFSET + (index << 2);
}

function readMid(index: i32): i32 {
  return load<i32>(midAddress(index));
}

function writeMid(index: i32, mid: i32): void {
  store<i32>(midAddress(index), mid);
}

function stepMid(mid: i32): i32 {
  const delta = below(5) - 2;
  if (delta > 0 && mid > 1_000_000_000 - delta) {
    return mid;
  }
  let next = mid + delta;
  if (next < 2) {
    next = 2;
  }
  return next;
}

export function init(count: i32, seed: u32): void {
  if (count < 1) {
    count = 1;
  }
  if (count > MAX_INSTRUMENTS) {
    count = MAX_INSTRUMENTS;
  }
  instrumentCount = count;
  rng = seed == 0 ? 1 : seed;
  for (let index: i32 = 0; index < MAX_INSTRUMENTS; index++) {
    writeMid(index, 10_000 + index * 50);
  }
}

export function generate(): void {
  const index = below(instrumentCount);
  const mid = stepMid(readMid(index));
  writeMid(index, mid);

  const spread = 1 + below(4);
  let bid = mid - (spread >> 1);
  if (bid < 1) {
    bid = 1;
  }
  let ask = bid + spread;
  if (ask <= bid) {
    ask = bid + 1;
  }

  instrumentIndex = index;
  bidCents = bid;
  askCents = ask;
  priceCents = (nextRandom() & 1) == 0 ? bid : ask;
  tradeQuantity = 1 + below(50);
  bidQuantity = below(500);
  askQuantity = below(500);
}

export function outInstrumentIndex(): i32 {
  return instrumentIndex;
}
export function outPriceCents(): i32 {
  return priceCents;
}
export function outTradeQuantity(): i32 {
  return tradeQuantity;
}
export function outBidCents(): i32 {
  return bidCents;
}
export function outAskCents(): i32 {
  return askCents;
}
export function outBidQuantity(): i32 {
  return bidQuantity;
}
export function outAskQuantity(): i32 {
  return askQuantity;
}
