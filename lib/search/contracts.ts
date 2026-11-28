import type { Opportunity } from "../opportunities"

export const types = ["Job", "Internship", "Scholarship"] as const
export const modes = ["Remote", "On-site", "Hybrid"] as const
export const sorts = ["Relevance", "Newest", "Deadline"] as const
export const periods = ["Today", "Past 7 days", "Past 30 days"] as const
export const compensationFilters = ["hourly-40", "annual-80", "funding"] as const

export type SearchFilters = {
  type?: typeof types[number]
  mode?: typeof modes[number]
  timePeriod?: typeof periods[number]
  compensation?: typeof compensationFilters[number]
  category?: string
  location?: string
}

export type SearchRequest = {
  query: string
  filters: SearchFilters
  sort: typeof sorts[number]
  pageSize: number
  cursor?: string
}

export type SearchHit = Opportunity & { postedAt: string | null; deadlineAt: string | null }
export type SearchResponse = {
  results: SearchHit[]
  nextCursor: string | null
  count: { value: number; relation: "bounded" | "exact" | "atLeast" }
  requestId: string
  rankingVersion: string
  degraded: string[]
}

export type IndexedOpportunity = Omit<Opportunity, "posted" | "deadline" | "compensation"> & {
  source: string
  sourceVersion: number
  canonicalUrl?: string
  canonicalKey: string
  postedAt: string | null
  deadlineAt: string | null
  updatedAt: string
  status: "active" | "closed" | "deleted"
  compensation: {
    label: string
    minimum?: number
    maximum?: number
    currency?: string
    period?: "hour" | "year" | "month" | "one-time"
    funding: boolean
  }
  locationKey: string
  skillKeys: string[]
  contentHash: string
  embeddingVersion?: string
  embedding?: number[]
}

export const embeddingModel = "BAAI/bge-small-en-v1.5"
export const candidateLimit = 200
export const rerankLimit = 30
