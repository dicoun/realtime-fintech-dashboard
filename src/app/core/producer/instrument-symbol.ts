const GREEK_LETTERS = [
  'ALFA',
  'BETA',
  'GAMMA',
  'DELTA',
  'EPSILON',
  'ZETA',
  'ETA',
  'THETA',
  'IOTA',
  'KAPPA',
  'LAMBDA',
  'MU',
  'NU',
  'XI',
  'OMICRON',
  'PI',
  'RHO',
  'SIGMA',
  'TAU',
  'UPSILON',
  'PHI',
  'CHI',
  'PSI',
  'OMEGA',
] as const;

export function instrumentSymbol(index: number): string {
  return GREEK_LETTERS[index] ?? `S${String(index + 1).padStart(2, '0')}`;
}
