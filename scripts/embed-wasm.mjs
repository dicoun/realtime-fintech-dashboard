import { readFileSync, writeFileSync } from 'node:fs';

const bytes = readFileSync(new URL('../public/market-producer.wasm', import.meta.url));
const values = [...bytes].join(', ');
const output = `// Generated from public/market-producer.wasm by scripts/embed-wasm.mjs. Do not edit.
export const marketProducerWasm = Uint8Array.from([
  ${values},
]);
`;

writeFileSync(new URL('../src/app/core/producer/market-producer.bytes.ts', import.meta.url), output);
