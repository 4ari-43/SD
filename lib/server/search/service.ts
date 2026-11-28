import { createHash, randomUUID } from "node:crypto"
import { rerankLimit, type IndexedOpportunity, type SearchFilters, type SearchHit, type SearchRequest, type SearchResponse } from "../../search/contracts.ts"
import { embeddingVersion, neuralRanker, queryEmbedding } from "./model.ts"
import { chronological, currentListings, lexical, openPit, vector, type SortValues } from "./opensearch.ts"
import { eligibility, isListingId, postedWindowStart, SearchError } from "./query.ts"
import { applyRerank, fuse, listingText } from "./ranking.ts"
import { cacheGet, cachePut, deadline, openSearch, UpstreamError } from "./transport.ts"

type Reference = Pick<IndexedOpportunity, "id" | "sourceVersion">
type Timings = Partial<Record<"cursorMs" | "lexicalMs" | "semanticMs" | "rerankMs" | "finalizeMs", number>>
type Session =
  | { kind: "ranked"; binding: string; refs: Reference[]; offset: number; count: SearchResponse["count"]; degraded: string[] }
  | { kind: "chrono"; binding: string; pit: string; after: SortValues; asOf: string; seen: string[]; count: SearchResponse["count"] }

const rankMode = () => process.env.SEARCH_RANKING_MODE === "rerank" ? "rerank"
  : process.env.SEARCH_RANKING_MODE === "bm25" ? "bm25" : "hybrid"

const rankingVersion = () => `v1:${rankMode()}:${embeddingVersion()}:${process.env.RERANK_VARIANT ?? "fp32"}`

function visible(item: IndexedOpportunity, now: Date) {
  return item.status === "active" && (item.deadlineAt === null || Date.parse(item.deadlineAt) >= now.getTime())
}

function matches(item: IndexedOpportunity, filters: SearchFilters, now: Date) {
  if (!visible(item, now)) return false
  if (filters.type && item.type !== filters.type) return false
  if (filters.mode && item.mode !== filters.mode) return false
  if (filters.category && item.category !== filters.category) return false
  if (filters.location && !item.locationKey.includes(filters.location)) return false
  if (filters.timePeriod) {
    if (!item.postedAt) return false
    const start = postedWindowStart(filters.timePeriod, now)
    if (Date.parse(item.postedAt) < start.getTime() || Date.parse(item.postedAt) > now.getTime()) return false
  }
  if (filters.compensation === "funding") return item.type === "Scholarship" || item.compensation.funding
  if (!filters.compensation) return true
  const hourly = filters.compensation === "hourly-40"
  return item.compensation.currency === "USD" && item.compensation.period === (hourly ? "hour" : "year")
    && (item.compensation.minimum ?? -1) >= (hourly ? 40 : 80000)
}

function publicListing(item: IndexedOpportunity): SearchHit {
  const { id, title, organization, type, category, location, mode, description, skills, postedAt, deadlineAt } = item
  return {
    id, title, organization, type, category, location, mode, description, skills, postedAt, deadlineAt,
    deadline: deadlineAt?.slice(0, 10) ?? "",
    posted: postedAt?.slice(0, 10) ?? "",
    compensation: item.compensation.label,
  }
}

export async function detail(id: string, signal: AbortSignal) {
  if (!isListingId(id)) return null
  const item = (await currentListings([id], signal)).get(id)
  return item && visible(item, new Date()) ? publicListing(item) : null
}

async function timed<T>(timings: Timings, stage: keyof Timings, work: () => Promise<T>) {
  const started = performance.now()
  try {
    return await work()
  } finally {
    timings[stage] = Math.round(performance.now() - started)
  }
}

async function rank(input: SearchRequest, now: Date, signal: AbortSignal, timings: Timings) {
  const mode = rankMode()
  const limit = deadline(250, signal)
  const filters = eligibility(input.filters, now)
  const [sparse, dense] = await Promise.allSettled([
    timed(timings, "lexicalMs", () => lexical(input.query, filters, limit)),
    mode !== "bm25"
      ? timed(timings, "semanticMs", async () => vector(await queryEmbedding(input.query, limit), embeddingVersion(), filters, limit))
      : Promise.resolve([]),
  ])
  if (sparse.status === "rejected" && (dense.status === "rejected" || !dense.value.length)) throw sparse.reason
  const degraded: string[] = []
  if (sparse.status === "rejected") degraded.push("lexical")
  if (dense.status === "rejected") degraded.push("semantic")
  let ranked = fuse([sparse.status === "fulfilled" ? sparse.value : [], dense.status === "fulfilled" ? dense.value : []])
  if (mode === "rerank" && ranked.length) {
    const started = performance.now()
    try {
      const budget = deadline(350, signal)
      const head = ranked.slice(0, rerankLimit)
      const documents = await currentListings(head.map(({ listing }) => listing.id), budget)
      const texts = head.map(({ listing }) => {
        const current = documents.get(listing.id)
        if (!current || current.sourceVersion !== listing.sourceVersion) throw new Error("Candidate changed")
        return listingText(current)
      })
      ranked = applyRerank(ranked, await neuralRanker.score(input.query, texts, budget))
    } catch {
      degraded.push("reranker")
    } finally {
      timings.rerankMs = Math.round(performance.now() - started)
    }
  }
  return { refs: ranked.map(({ listing: { id, sourceVersion } }) => ({ id, sourceVersion })), degraded }
}

async function resume(cursor: string, binding: string, signal: AbortSignal) {
  let session: Session | null
  try {
    session = await cacheGet<Session>("page:" + cursor, deadline(60, signal))
  } catch {
    throw new SearchError(503, "cursor_store_unavailable")
  }
  if (!session || session.binding !== binding) throw new SearchError(410, "restart_search")
  return session
}

export async function search(input: SearchRequest, signal: AbortSignal, requestId = randomUUID(), timings: Timings = {}): Promise<SearchResponse> {
  const now = new Date()
  const version = rankingVersion()
  const binding = createHash("sha256").update(JSON.stringify([input.query, input.filters, input.sort, input.pageSize, version])).digest("hex")
  const cursor = input.cursor
  const session = cursor ? await timed(timings, "cursorMs", () => resume(cursor, binding, signal)) : null
  const ranked = Boolean(input.query && input.sort === "Relevance")
  const results: SearchHit[] = []
  const degraded: string[] = []
  let count: SearchResponse["count"]
  let next: Session | undefined
  let finalizationStarted = performance.now()
  const append = (refs: Reference[], source: Map<string, IndexedOpportunity>, seen: Set<string>) => {
    let consumed = 0
    for (const ref of refs) {
      if (results.length === input.pageSize) break
      consumed++
      const item = source.get(ref.id)
      if (!item || ref.sourceVersion !== item.sourceVersion || seen.has(item.canonicalKey) || !matches(item, input.filters, now)) continue
      seen.add(item.canonicalKey)
      results.push(publicListing(item))
    }
    return consumed
  }

  if (ranked) {
    if (session && session.kind !== "ranked") throw new SearchError(410, "restart_search")
    const state = session ?? await rank(input, now, signal, timings)
    finalizationStarted = performance.now()
    degraded.push(...state.degraded)
    count = { value: state.refs.length, relation: "bounded" }
    const offset = session?.offset ?? 0
    const finalization = deadline(100, signal)
    let consumed = 0
    const seen = new Set<string>()
    // Most pages need one multi-get. Widen only when stale listings thin the page.
    while (offset + consumed < state.refs.length && results.length < input.pageSize) {
      const batchSize = consumed ? 50 : input.pageSize
      const batch = state.refs.slice(offset + consumed, offset + consumed + batchSize)
      const current = await currentListings(batch.map(ref => ref.id), finalization)
      consumed += append(batch, current, seen)
    }
    if (offset + consumed < state.refs.length) {
      next = { kind: "ranked", binding, refs: state.refs, offset: offset + consumed, count, degraded: [...degraded] }
    }
  } else {
    if (session && session.kind !== "chrono") throw new SearchError(410, "restart_search")
    const budget = deadline(600, signal)
    let pit = session?.pit
    if (!pit) {
      try {
        pit = await openPit(deadline(150, budget))
      } catch {
        degraded.push("pagination")
      }
    }
    const asOf = session ? new Date(session.asOf) : now
    const sort = input.sort === "Deadline" ? "Deadline" : "Newest"
    const seen = new Set(session?.seen)
    let after = session?.after
    let hasMore = true
    count = session?.count ?? { value: 0, relation: "exact" }
    const batchSize = Math.max(32, input.pageSize + 1)
    for (let batch = 0; batch < (pit ? 4 : 1) && hasMore && results.length < input.pageSize; batch++) {
      let page
      try {
        page = await chronological(input.query, input.filters, asOf, sort, batchSize, budget, pit, after, !session && batch === 0)
      } catch (error) {
        if (session && error instanceof UpstreamError && error.status === 404) throw new SearchError(410, "restart_search")
        throw error
      }
      if (page.pit_id) pit = page.pit_id
      const hits = page.hits.hits
      const total = page.hits.total
      if (total) count = { value: total.value, relation: total.relation === "eq" ? "exact" : "atLeast" }
      const refs = hits.map(hit => hit._source)
      const current = await currentListings(refs.map(ref => ref.id), budget)
      const consumed = append(refs, current, seen)
      hasMore = consumed < hits.length || hits.length === batchSize
      if (consumed) after = hits[consumed - 1].sort
      if (!after) break
    }
    if (pit && after && hasMore) next = { kind: "chrono", binding, pit, after, asOf: asOf.toISOString(), seen: [...seen], count }
    if (pit && !next && !session) {
      void openSearch("/_search/point_in_time", "DELETE", { pit_id: [pit] }).catch(() => undefined)
    }
  }

  let nextCursor: string | null = null
  if (next) {
    const key = randomUUID()
    try {
      await cachePut("page:" + key, next, next.kind === "ranked" ? 300 : 60, deadline(35, signal))
      nextCursor = key
    } catch {
      degraded.push("pagination")
      if (next.kind === "chrono" && !session) {
        void openSearch("/_search/point_in_time", "DELETE", { pit_id: [next.pit] }).catch(() => undefined)
      }
    }
  }
  timings.finalizeMs = Math.round(performance.now() - finalizationStarted)
  return { results, nextCursor, count, requestId, rankingVersion: version, degraded }
}
