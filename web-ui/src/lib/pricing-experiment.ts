export type PricingNarrativeVariant = 'control-layer-led' | 'feature-led';
export type PricingExperimentSource = 'query' | 'storage' | 'deterministic';

export interface PricingExperimentAssignment {
  variant: PricingNarrativeVariant;
  source: PricingExperimentSource;
  seed: string;
}

const STORAGE_VARIANT_KEY = 'sg_pricing_variant';
const STORAGE_SEED_KEY = 'sg_pricing_seed';

function hashToBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

function resolveQueryVariant(search: string): PricingNarrativeVariant | null {
  const value = new URLSearchParams(search).get('pricing_variant');
  if (value === 'feature-led' || value === 'control-layer-led') {
    return value;
  }
  return null;
}

function resolveStoredVariant(storage: Storage): PricingNarrativeVariant | null {
  const stored = storage.getItem(STORAGE_VARIANT_KEY);
  if (stored === 'feature-led' || stored === 'control-layer-led') {
    return stored;
  }
  return null;
}

function resolveSeed(storage: Storage): string {
  const existing = storage.getItem(STORAGE_SEED_KEY);
  if (existing) {
    return existing;
  }
  const created =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `seed-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(STORAGE_SEED_KEY, created);
  return created;
}

export function resolvePricingExperimentAssignment(
  search: string,
  storage: Storage,
): PricingExperimentAssignment {
  const queryVariant = resolveQueryVariant(search);
  if (queryVariant) {
    const seed = resolveSeed(storage);
    storage.setItem(STORAGE_VARIANT_KEY, queryVariant);
    return { variant: queryVariant, source: 'query', seed };
  }

  const storedVariant = resolveStoredVariant(storage);
  if (storedVariant) {
    const seed = resolveSeed(storage);
    return { variant: storedVariant, source: 'storage', seed };
  }

  const seed = resolveSeed(storage);
  const variant: PricingNarrativeVariant =
    hashToBucket(seed) < 50 ? 'control-layer-led' : 'feature-led';
  storage.setItem(STORAGE_VARIANT_KEY, variant);
  return { variant, source: 'deterministic', seed };
}

export function resolvePricingExperimentFromBrowser(): PricingExperimentAssignment {
  if (typeof window === 'undefined') {
    return {
      variant: 'control-layer-led',
      source: 'deterministic',
      seed: 'server-render',
    };
  }
  return resolvePricingExperimentAssignment(window.location.search, window.localStorage);
}
