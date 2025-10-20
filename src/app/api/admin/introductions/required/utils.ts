import type { Innovator, RequiredIntroductionRule } from '@prisma/client'

export type RuleWithInnovator = RequiredIntroductionRule & {
  innovator: Pick<Innovator, 'id' | 'name' | 'url' | 'introPoint'>
}

export const parseStringArray = (value: string | null): string[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const mapRule = (rule: RuleWithInnovator) => ({
  id: rule.id,
  innovatorId: rule.innovatorId,
  startDate: rule.startDate.toISOString(),
  endDate: rule.endDate.toISOString(),
  tiers: parseStringArray(rule.tiers),
  strengths: parseStringArray(rule.strengths),
  createdAt: rule.createdAt.toISOString(),
  updatedAt: rule.updatedAt.toISOString(),
  innovator: {
    id: rule.innovator.id,
    name: rule.innovator.name,
    url: rule.innovator.url,
    introPoint: rule.innovator.introPoint,
  },
})
