import type { Prisma } from '@prisma/client'

import type { BusinessDomainValue } from '@/lib/business-domain'
import type { ColumnSet } from '@/lib/live-schema'
import { hasAnyColumn } from '@/lib/live-schema'

export type InnovatorColumnAvailability = {
  id: boolean
  company: boolean
  domain: boolean
  url: boolean
  introductionPoint: boolean
  createdAt: boolean
  updatedAt: boolean
}

export type InnovatorPayload = {
  company?: string
  url?: string | null
  introductionPoint?: string | null
  domain?: BusinessDomainValue
}

export function computeAvailability(columns: ColumnSet): InnovatorColumnAvailability {
  return {
    id: hasAnyColumn(columns, 'id'),
    company: hasAnyColumn(columns, 'company', 'name'),
    domain: hasAnyColumn(columns, 'domain'),
    url: hasAnyColumn(columns, 'url'),
    introductionPoint: hasAnyColumn(columns, 'introductionPoint'),
    createdAt: hasAnyColumn(columns, 'createdAt'),
    updatedAt: hasAnyColumn(columns, 'updatedAt'),
  }
}

export function buildSelect(
  availability: InnovatorColumnAvailability
): Prisma.InnovatorSelect | undefined {
  const select: Prisma.InnovatorSelect = {}

  if (availability.id) {
    select.id = true
  }
  if (availability.company) {
    select.company = true
  }
  if (availability.domain) {
    select.domain = true
  }
  if (availability.createdAt) {
    select.createdAt = true
  }
  if (availability.updatedAt) {
    select.updatedAt = true
  }
  if (availability.url) {
    select.url = true
  }
  if (availability.introductionPoint) {
    select.introductionPoint = true
  }

  return Object.keys(select).length > 0 ? select : undefined
}

export function mapPayloadToData(
  payload: InnovatorPayload,
  availability: InnovatorColumnAvailability
): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  if (availability.company && payload.company !== undefined) {
    data.company = payload.company
  }

  if (availability.domain && payload.domain !== undefined) {
    data.domain = payload.domain
  }

  if (availability.url && payload.url !== undefined) {
    data.url = payload.url
  }

  if (availability.introductionPoint && payload.introductionPoint !== undefined) {
    data.introductionPoint = payload.introductionPoint
  }

  return data
}
