import { candidateLimit, type IndexedOpportunity, type SearchFilters } from "../../search/contracts.ts"
import { eligibility, lexicalQuery, normalize } from "./query.ts"
import { indexName, openSearch, UpstreamError } from "./transport.ts"

export type SortValues = (number | string | null)[]
type Hit = { _source: IndexedOpportunity; _score: number | null; sort?: SortValues }
type SearchResult = {
  pit_id?: string
  timed_out?: boolean
  _shards?: { failed: number }
  hits: { total?: { value: number; relation: "eq" | "gte" }; hits: Hit[] }
  aggregations?: Record<string, { buckets: { key: string }[] }>
}

const indexPath = () => "/" + indexName()
const excludes = { excludes: ["embedding"] }
const rankedFields = { includes: ["id", "canonicalKey", "sourceVersion", "postedAt"] }
const partial = { allow_partial_search_results: "false" }

async function run(body: unknown, signal: AbortSignal, pit = false) {
  const res = await openSearch<SearchResult>(`${pit ? "" : indexPath()}/_search?${new URLSearchParams(partial)}`, "POST", body, signal)
  if (res.timed_out || res._shards?.failed) throw new UpstreamError("opensearch", 503)
  return res
}

export async function lexical(query: string, filter: ReturnType<typeof eligibility>, signal: AbortSignal) {
  const result = await run({
    size: candidateLimit, track_total_hits: false, _source: rankedFields,
    query: lexicalQuery(query, filter),
    sort: [{ _score: "desc" }, { postedAt: { order: "desc", missing: "_last" } }, { id: "asc" }],
  }, signal)
  return result.hits.hits.map(hit => ({ listing: hit._source, score: hit._score ?? 0 }))
}

export async function vector(embedding: number[], version: string, filter: ReturnType<typeof eligibility>, signal: AbortSignal) {
  const result = await run({
    size: candidateLimit, track_total_hits: false, _source: rankedFields,
    query: { knn: { embedding: { vector: embedding, k: candidateLimit, filter: { bool: { filter: [
      ...filter, { term: { embeddingVersion: version } },
    ] } } } } },
    sort: [{ _score: "desc" }, { postedAt: { order: "desc", missing: "_last" } }, { id: "asc" }],
  }, signal)
  return result.hits.hits.map(hit => ({ listing: hit._source, score: hit._score ?? 0 }))
}

export async function openPit(signal: AbortSignal) {
  const result = await openSearch<{ pit_id: string }>(`${indexPath()}/_search/point_in_time?keep_alive=70s&allow_partial_pit_creation=false`, "POST", undefined, signal)
  return result.pit_id
}

export async function chronological(
  query: string, filters: SearchFilters, asOf: Date, sort: "Newest" | "Deadline", size: number,
  signal: AbortSignal, pit?: string, after?: SortValues, count = true,
) {
  return run({
    size, track_total_hits: count ? 10000 : false,
    _source: { includes: ["id", "sourceVersion"] },
    query: lexicalQuery(query, eligibility(filters, asOf)),
    sort: [{ [sort === "Newest" ? "postedAt" : "deadlineAt"]: { order: sort === "Newest" ? "desc" : "asc", missing: "_last" } }, { id: "asc" }],
    ...(pit && { pit: { id: pit, keep_alive: "70s" } }),
    ...(after && { search_after: after }),
  }, signal, Boolean(pit))
}

export async function currentListings(ids: string[], signal: AbortSignal) {
  if (!ids.length) return new Map<string, IndexedOpportunity>()
  const res = await openSearch<{ docs: { found: boolean; _source?: IndexedOpportunity; error?: unknown }[] }>(
    `${indexPath()}/_mget`, "POST", { docs: ids.map(_id => ({ _id, _source: excludes })) }, signal,
  )
  if (res.docs.some(doc => doc.error)) throw new UpstreamError("opensearch", 503)
  return new Map(res.docs.flatMap(doc => doc.found && doc._source ? [[doc._source.id, doc._source] as const] : []))
}

export async function categories(signal: AbortSignal) {
  const result = await run({
    size: 0, track_total_hits: false, query: lexicalQuery("", eligibility({}, new Date())),
    aggs: { categories: { terms: { field: "category", size: 100, order: { _key: "asc" } } } },
  }, signal)
  return result.aggregations?.categories.buckets.map(bucket => bucket.key) ?? []
}

export async function suggest(query: string, signal: AbortSignal) {
  if (!query) return []
  const labels = ["title", "skills", "category"]
  const result = await run({
    size: 20, track_total_hits: false, _source: { includes: labels },
    query: { bool: { filter: eligibility({}, new Date()), should: labels.map(field => ({
      match: { [`${field}.prefix`]: query },
    })), minimum_should_match: 1 } },
  }, signal)
  const unique = new Map<string, string>()
  for (const { _source: item } of result.hits.hits) {
    for (const label of [item.title, ...item.skills, item.category]) {
      const key = normalize(label)
      if (key.startsWith(query) && !unique.has(key)) unique.set(key, label)
    }
  }
  return [...unique.values()].slice(0, 7)
}
