import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const FIELD_TO_COLUMN: Record<string, string> = {
  recordId: 'recordId',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  contactMethod: 'contactPref',
  supportPriority: 'supportPriority',
  pattern: 'pattern',
  meetingStatus: 'meetingStatus',
  registrationStatus: 'registrationStatus',
  lineRegistered: 'lineRegistered',
  phoneNumber: 'phoneNumber',
  acquisitionSource: 'acquisitionSource',
  facebookUrl: 'facebookUrl',
  listAcquired: 'listAcquired',
  listProvided: 'listProvided',
  matchingListUrl: 'matchingListUrl',
  contactOwner: 'contactOwner',
  marketingContactStatus: 'marketingContactStatus',
  sourceCreatedAt: 'sourceCreatedAt',
  strength: 'strengths',
  notes: 'notes',
  nextAction: 'nextAction',
  nextActionDueOn: 'nextActionDueOn',
  managementPhase: 'managementPhase',
  tier: 'tier',
  assignedCsId: 'assignedCsId',
  tags: 'tags',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

let evangelistColumnsCache: Set<string> | null = null;

export async function getEvangelistColumnSet(): Promise<Set<string>> {
  if (evangelistColumnsCache) {
    return evangelistColumnsCache;
  }

  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'evangelists'
  `);

  evangelistColumnsCache = new Set(rows.map((row) => row.column_name));
  return evangelistColumnsCache;
}

export function filterEvangelistData<T extends Record<string, unknown>>(
  data: T,
  columns: Set<string>,
): T {
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    const columnName = FIELD_TO_COLUMN[key] ?? key;
    if (!columns.has(columnName)) {
      continue;
    }

    filtered[key] = value;
  }

  return filtered as T;
}

type BuildSelectOptions = {
  includeAssignedCs?: boolean;
  includeCount?: boolean;
};

export function buildEvangelistSelect(
  columns: Set<string>,
  options: BuildSelectOptions = {},
): Prisma.EvangelistSelect {
  const select: Prisma.EvangelistSelect = {
    id: true,
  };

  const maybeInclude = (field: keyof typeof FIELD_TO_COLUMN | 'id') => {
    if (field === 'id') return true;
    const columnName = FIELD_TO_COLUMN[field];
    return columnName ? columns.has(columnName) : false;
  };

  if (maybeInclude('recordId')) select.recordId = true;
  if (maybeInclude('firstName')) select.firstName = true;
  if (maybeInclude('lastName')) select.lastName = true;
  if (maybeInclude('email')) select.email = true;
  if (maybeInclude('contactMethod')) select.contactMethod = true;
  if (maybeInclude('supportPriority')) select.supportPriority = true;
  if (maybeInclude('pattern')) select.pattern = true;
  if (maybeInclude('meetingStatus')) select.meetingStatus = true;
  if (maybeInclude('registrationStatus')) select.registrationStatus = true;
  if (maybeInclude('lineRegistered')) select.lineRegistered = true;
  if (maybeInclude('phoneNumber')) select.phoneNumber = true;
  if (maybeInclude('acquisitionSource')) select.acquisitionSource = true;
  if (maybeInclude('facebookUrl')) select.facebookUrl = true;
  if (maybeInclude('listAcquired')) select.listAcquired = true;
  if (maybeInclude('listProvided')) select.listProvided = true;
  if (maybeInclude('matchingListUrl')) select.matchingListUrl = true;
  if (maybeInclude('contactOwner')) select.contactOwner = true;
  if (maybeInclude('marketingContactStatus')) select.marketingContactStatus = true;
  if (maybeInclude('sourceCreatedAt')) select.sourceCreatedAt = true;
  if (maybeInclude('strength')) select.strength = true;
  if (maybeInclude('notes')) select.notes = true;
  if (maybeInclude('nextAction')) select.nextAction = true;
  if (maybeInclude('nextActionDueOn')) select.nextActionDueOn = true;
  if (maybeInclude('managementPhase')) select.managementPhase = true;
  if (maybeInclude('tier')) select.tier = true;
  if (maybeInclude('assignedCsId')) select.assignedCsId = true;
  if (maybeInclude('tags')) select.tags = true;
  if (maybeInclude('createdAt')) select.createdAt = true;
  if (maybeInclude('updatedAt')) select.updatedAt = true;

  if (options.includeAssignedCs) {
    select.assignedCs = {
      select: {
        id: true,
        name: true,
      },
    };
  }

  if (options.includeCount) {
    select._count = {
      select: {
        meetings: true,
      },
    };
  }

  return select;
}

const DEFAULT_SCALAR_FIELDS: string[] = [
  'recordId',
  'firstName',
  'lastName',
  'email',
  'contactMethod',
  'supportPriority',
  'pattern',
  'meetingStatus',
  'registrationStatus',
  'lineRegistered',
  'phoneNumber',
  'acquisitionSource',
  'facebookUrl',
  'listAcquired',
  'listProvided',
  'matchingListUrl',
  'contactOwner',
  'marketingContactStatus',
  'sourceCreatedAt',
  'strength',
  'notes',
  'nextAction',
  'nextActionDueOn',
  'managementPhase',
  'tier',
  'assignedCsId',
  'tags',
  'createdAt',
  'updatedAt',
];

export function normalizeEvangelistResult<T extends Record<string, unknown>>(
  evangelist: T,
): T & {
  assignedCs: { id: string; name: string } | null;
  _count?: { meetings: number };
} {
  const normalized: Record<string, unknown> = { ...evangelist };

  for (const field of DEFAULT_SCALAR_FIELDS) {
    if (!(field in normalized)) {
      normalized[field] = null;
    }
  }

  if (!('assignedCs' in normalized)) {
    normalized.assignedCs = null;
  }

  if ('listProvided' in normalized) {
    normalized.listProvided = normalized.listProvided ? true : false;
  } else {
    normalized.listProvided = false;
  }

  if ('_count' in normalized) {
    const countValue = normalized._count as { meetings?: number } | undefined;
    normalized._count = {
      meetings: countValue?.meetings ?? 0,
    };
  } else {
    normalized._count = { meetings: 0 };
  }

  return normalized as T & {
    assignedCs: { id: string; name: string } | null;
    _count: { meetings: number };
  };
}

export function clearEvangelistColumnCache() {
  evangelistColumnsCache = null;
}

