export interface GeneratedUpdate {
  instrumentIndex: number;
  priceCents: number;
  tradeQuantity: number;
  bidCents: number;
  askCents: number;
  bidQuantity: number;
  askQuantity: number;
}

export interface MarketGenerator {
  init(instrumentCount: number, seed: number): void;
  nextUpdate(): GeneratedUpdate;
}

interface MarketProducerExports {
  init(count: number, seed: number): void;
  generate(): void;
  outInstrumentIndex(): number;
  outPriceCents(): number;
  outTradeQuantity(): number;
  outBidCents(): number;
  outAskCents(): number;
  outBidQuantity(): number;
  outAskQuantity(): number;
}

const EXPORT_NAMES = [
  'init',
  'generate',
  'outInstrumentIndex',
  'outPriceCents',
  'outTradeQuantity',
  'outBidCents',
  'outAskCents',
  'outBidQuantity',
  'outAskQuantity',
] as const;

export async function instantiateMarketGenerator(
  bytes: ArrayBuffer | Uint8Array,
): Promise<MarketGenerator> {
  let compiled: WebAssembly.WebAssemblyInstantiatedSource;
  try {
    compiled = await WebAssembly.instantiate(toArrayBuffer(bytes));
  } catch (error) {
    throw new Error(`Failed to instantiate market producer wasm: ${errorText(error)}`);
  }

  const wasm = readExports(compiled.instance.exports);
  return {
    init(instrumentCount, seed) {
      wasm.init(instrumentCount, seed);
    },
    nextUpdate() {
      wasm.generate();
      return {
        instrumentIndex: wasm.outInstrumentIndex(),
        priceCents: wasm.outPriceCents(),
        tradeQuantity: wasm.outTradeQuantity(),
        bidCents: wasm.outBidCents(),
        askCents: wasm.outAskCents(),
        bidQuantity: wasm.outBidQuantity(),
        askQuantity: wasm.outAskQuantity(),
      };
    },
  };
}

interface WasmResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function loadMarketProducerBytes(
  fetchWasm: (url: string) => Promise<WasmResponse>,
  url = '/market-producer.wasm',
): Promise<ArrayBuffer> {
  const response = await fetchWasm(url);
  if (!response.ok) {
    throw new Error(`Failed to load market producer wasm (${response.status})`);
  }
  return response.arrayBuffer();
}

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function readExports(exports: WebAssembly.Exports): MarketProducerExports {
  const read = {} as MarketProducerExports;
  for (const name of EXPORT_NAMES) {
    const value = exports[name];
    if (typeof value !== 'function') {
      throw new Error(`Market producer wasm is missing export ${name}`);
    }
    Reflect.set(read, name, value);
  }
  return read;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown wasm error';
}
