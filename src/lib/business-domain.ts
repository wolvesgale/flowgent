export const BUSINESS_DOMAIN_VALUES = [
  'HR',
  'IT',
  'ACCOUNTING',
  'ADVERTISING',
  'MANAGEMENT',
  'SALES',
  'MANUFACTURING',
  'MEDICAL',
  'FINANCE',
] as const;

export type BusinessDomainValue = (typeof BUSINESS_DOMAIN_VALUES)[number];

const BUSINESS_DOMAIN_SET = new Set<BusinessDomainValue>(BUSINESS_DOMAIN_VALUES);

const DOMAIN_ALIASES: Record<string, BusinessDomainValue> = {
  hr: 'HR',
  '人事': 'HR',
  '人材': 'HR',
  it: 'IT',
  'アイティー': 'IT',
  accounting: 'ACCOUNTING',
  '会計': 'ACCOUNTING',
  '経理': 'ACCOUNTING',
  advertising: 'ADVERTISING',
  '広告': 'ADVERTISING',
  'マーケ': 'ADVERTISING',
  'マーケティング': 'ADVERTISING',
  management: 'MANAGEMENT',
  '経営': 'MANAGEMENT',
  sales: 'SALES',
  '営業': 'SALES',
  manufacturing: 'MANUFACTURING',
  '製造': 'MANUFACTURING',
  'ものづくり': 'MANUFACTURING',
  medical: 'MEDICAL',
  '医療': 'MEDICAL',
  'ヘルスケア': 'MEDICAL',
  finance: 'FINANCE',
  '金融': 'FINANCE',
};

export function mapBusinessDomain(input: unknown): BusinessDomainValue | undefined {
  if (typeof input !== 'string') return undefined;

  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const upperCased = trimmed.toUpperCase() as BusinessDomainValue;
  if (BUSINESS_DOMAIN_SET.has(upperCased)) {
    return upperCased;
  }

  const aliasKey = trimmed.toLowerCase();
  return DOMAIN_ALIASES[aliasKey];
}

export function mapBusinessDomainOrDefault(
  input: unknown,
  fallback: BusinessDomainValue = 'IT',
): BusinessDomainValue {
  return mapBusinessDomain(input) ?? fallback;
}
