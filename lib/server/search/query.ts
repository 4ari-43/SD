import {
  compensationFilters, modes, periods, sorts, types,
  type SearchFilters, type SearchRequest,
} from "../../search/contracts.ts"

export class SearchError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export function normalize(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

export function isListingId(value: string) {
  return /^[\w.-]{1,128}$/.test(value) && ![".", "..", "search", "facets", "suggestions"].includes(value)
}

function invalid(): never {
  throw new SearchError(400, "invalid_search_request")
}

export function parseRequest(value: unknown): SearchRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid()
  const input = value as Record<string, unknown>
  const filters: SearchFilters = {}
  const query = input.query ?? ""
  const sort = input.sort ?? "Relevance"
  const pageSize = input.pageSize ?? 20
  const cursor = input.cursor
  if (typeof query !== "string" || query.length > 256 || normalize(query).length > 256) invalid()
  if (!sorts.includes(sort as typeof sorts[number])) invalid()
  if (typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) invalid()
  if (cursor !== undefined && (typeof cursor !== "string" || !/^[\da-f-]{36}$/i.test(cursor))) invalid()
  const raw = input.filters ?? {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid()
  const fields = raw as Record<string, unknown>
  const enums = { type: types, mode: modes, timePeriod: periods, compensation: compensationFilters } as const
  for (const key of Object.keys(fields)) {
    if (!Object.hasOwn(enums, key) && key !== "location" && key !== "category") invalid()
  }
  // Iterate in a fixed order so equivalent requests share the same cursor binding.
  for (const key of Object.keys(enums) as (keyof typeof enums)[]) {
    const field = fields[key]
    if (field === undefined) continue
    if (!(enums[key] as readonly unknown[]).includes(field)) invalid()
    Object.assign(filters, { [key]: field })
  }
  for (const key of ["category", "location"] as const) {
    const field = fields[key]
    if (field === undefined) continue
    if (typeof field !== "string" || field.length > 100) invalid()
    const cleaned = key === "location" ? normalize(field) : field.trim()
    if (cleaned) filters[key] = cleaned
  }
  return { query: normalize(query), sort: sort as SearchRequest["sort"], pageSize, filters, cursor }
}

export function postedWindowStart(period: NonNullable<SearchFilters["timePeriod"]>, now: Date) {
  const start = new Date(now)
  if (period === "Today") start.setUTCHours(0, 0, 0, 0)
  else start.setUTCDate(start.getUTCDate() - (period === "Past 7 days" ? 7 : 30))
  return start
}

export function eligibility(filters: SearchFilters, now: Date) {
  const rules: Record<string, unknown>[] = [
    { term: { status: "active" } },
    { bool: { should: [
      { range: { deadlineAt: { gte: now.toISOString() } } },
      { bool: { must_not: { exists: { field: "deadlineAt" } } } },
    ], minimum_should_match: 1 } },
  ]
  if (filters.type) rules.push({ term: { type: filters.type } })
  if (filters.mode) rules.push({ term: { mode: filters.mode } })
  if (filters.category) rules.push({ term: { category: filters.category } })
  if (filters.location) {
    const literal = filters.location.replace(/[\\*?]/g, "\\$&")
    rules.push({ wildcard: { locationKey: { value: `*${literal}*` } } })
  }
  if (filters.timePeriod) {
    const start = postedWindowStart(filters.timePeriod, now)
    rules.push({ range: { postedAt: { gte: start.toISOString(), lte: now.toISOString() } } })
  }
  if (filters.compensation === "funding") {
    rules.push({ bool: { should: [{ term: { type: "Scholarship" } }, { term: { "compensation.funding": true } }], minimum_should_match: 1 } })
  } else if (filters.compensation) {
    const hourly = filters.compensation === "hourly-40"
    rules.push({ term: { "compensation.currency": "USD" } }, { term: { "compensation.period": hourly ? "hour" : "year" } },
      { range: { "compensation.minimum": { gte: hourly ? 40 : 80000 } } })
  }
  return rules
}

const synonyms = [
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["software engineer", "software developer"],
  ["full stack", "full-stack"],
] as const

const fields = ["title^4", "skills^3", "organization^2", "category.text^2", "description", "location", "type.text"]
export function lexicalQuery(query: string, filters: ReturnType<typeof eligibility>) {
  if (!query) return { bool: { filter: filters } }
  const alternatives = synonyms.flatMap(group => group.some(term => term === query || ` ${query} `.includes(` ${term} `))
    ? group.filter(term => !` ${query} `.includes(` ${term} `)) : [])
  const should: Record<string, unknown>[] = [
    { multi_match: { query, fields, type: "cross_fields", operator: "or" } },
    { multi_match: { query, fields: ["title^4", "skills^3", "organization^2"], type: "phrase", boost: 2 } },
    ...alternatives.map(term => ({ multi_match: { query: term, fields, type: "phrase", boost: 0.5 } })),
  ]
  return { bool: { filter: filters, should, minimum_should_match: 1 } }
}
