export type MarketCategoryKey =
  | 'politics'
  | 'sports'
  | 'crypto'
  | 'macro'
  | 'tech'
  | 'entertainment'
  | 'other';

const CATEGORY_LABELS: Record<MarketCategoryKey, string> = {
  politics: 'Politics',
  sports: 'Sports',
  crypto: 'Crypto',
  macro: 'Macro',
  tech: 'Technology',
  entertainment: 'Entertainment',
  other: 'Other',
};

const CATEGORY_ALIASES: Record<string, MarketCategoryKey> = {
  politics: 'politics',
  political: 'politics',
  election: 'politics',
  government: 'politics',
  sports: 'sports',
  sport: 'sports',
  soccer: 'sports',
  football: 'sports',
  basketball: 'sports',
  crypto: 'crypto',
  cryptocurrency: 'crypto',
  bitcoin: 'crypto',
  ethereum: 'crypto',
  macro: 'macro',
  economics: 'macro',
  economy: 'macro',
  finance: 'macro',
  technology: 'tech',
  tech: 'tech',
  ai: 'tech',
  entertainment: 'entertainment',
  culture: 'entertainment',
  other: 'other',
};

const CATEGORY_RULES: { key: MarketCategoryKey; patterns: RegExp[] }[] = [
  {
    key: 'politics',
    patterns: [
      /\b(trump|biden|president|presidential|election|nominee|senate|house|congress|democrat|democratic|republican|governor|mayor|primary|campaign|vote|poll)\b/i,
    ],
  },
  {
    key: 'sports',
    patterns: [
      /\b(fifa|world cup|nba|nfl|mlb|nhl|ufc|tennis|golf|soccer|football|basketball|baseball|champion|premier league|la liga|serie a|bundesliga|uefa|olympic)\b/i,
    ],
  },
  {
    key: 'crypto',
    patterns: [
      /\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|crypto|stablecoin|token|defi|nft|binance|coinbase)\b/i,
    ],
  },
  {
    key: 'macro',
    patterns: [
      /\b(fed|rate cut|interest rate|inflation|cpi|gdp|recession|treasury|unemployment|jobs report|oil|gold|tariff|market crash)\b/i,
    ],
  },
  {
    key: 'tech',
    patterns: [
      /\b(openai|deepseek|anthropic|ai|artificial intelligence|tesla|spacex|apple|nvidia|microsoft|google|meta|amazon|robotaxi|iphone)\b/i,
    ],
  },
  {
    key: 'entertainment',
    patterns: [
      /\b(oscar|oscars|grammy|movie|film|box office|album|song|streaming|netflix|disney|taylor swift|celebrity)\b/i,
    ],
  },
];

export function marketCategoryLabel(key: string | null | undefined): string {
  return CATEGORY_LABELS[normalizeMarketCategoryKey(key) ?? 'other'];
}

export function marketCategoryTags(tags: unknown, fallbackValues: unknown[]): string[] {
  return [readMarketCategoryKey(tags, fallbackValues)];
}

export function readMarketCategoryKey(tags: unknown, fallbackValues: unknown[] = []): MarketCategoryKey {
  const explicit = readExplicitCategoryKey(tags);
  if (explicit) return explicit;
  return inferMarketCategoryKey(fallbackValues);
}

export function inferMarketCategoryKey(values: unknown[]): MarketCategoryKey {
  const text = values
    .flatMap((value) => (typeof value === 'string' ? [value] : []))
    .join(' ')
    .toLowerCase();
  if (!text) return 'other';

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.key;
    }
  }
  return 'other';
}

export function normalizeMarketCategoryKey(value: unknown): MarketCategoryKey | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  if (!normalized) return null;
  return CATEGORY_ALIASES[normalized] ?? null;
}

function readExplicitCategoryKey(tags: unknown): MarketCategoryKey | null {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    const key = normalizeMarketCategoryKey(tag);
    if (key) return key;
    if (tag && typeof tag === 'object' && !Array.isArray(tag)) {
      const record = tag as Record<string, unknown>;
      const recordKey = normalizeMarketCategoryKey(record.slug)
        ?? normalizeMarketCategoryKey(record.label)
        ?? normalizeMarketCategoryKey(record.name);
      if (recordKey) return recordKey;
    }
  }
  return null;
}
