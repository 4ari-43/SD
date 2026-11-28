import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { IndexedOpportunity } from "../../lib/search/contracts.ts"
import { parseListing } from "../../lib/server/search/ingest.ts"
import { embeddingVersion } from "../../lib/server/search/model.ts"
import { eligibility, lexicalQuery, parseRequest } from "../../lib/server/search/query.ts"
import { applyRerank, fuse } from "../../lib/server/search/ranking.ts"
import { detail, search } from "../../lib/server/search/service.ts"

const listings = readFileSync(new URL("./fixtures/listings.jsonl", import.meta.url), "utf8").trim().split("\n")
  .map(line => parseListing(JSON.parse(line))) as IndexedOpportunity[]
const [cpp, intern, grant, dotnet] = listings
const candidate = (listing: IndexedOpportunity, score = 1) => ({ listing, score })

test("RRF counts each canonical listing once per branch and combines ranks, regardless of score scale", () => {
  const duplicate = { ...intern, id: "copy" }
  const result = fuse([[candidate(cpp, 10000), candidate(intern), candidate(duplicate)], [candidate(duplicate), candidate(grant)]])
  assert.deepEqual(result.map(hit => hit.listing.id), [intern.id, cpp.id, grant.id])
  assert.equal(result[0].score, 1 / 62 + 1 / 61)
  assert.deepEqual(applyRerank(result, [-2, 5, 5]).map(hit => hit.listing.id), [cpp.id, grant.id, intern.id])
  assert.throws(() => applyRerank(result, [NaN, 5, 5]))
})

test("reranking changes only the first 30 results and validates request bounds", () => {
  const ranked = fuse([Array.from({ length: 220 }, (_, i) => candidate({ ...cpp, id: String(i), canonicalKey: String(i) }))])
  assert.equal(ranked.length, 200)
  const corrected = applyRerank(ranked, Array.from({ length: 30 }, (_, i) => i))
  assert.equal(corrected[0].listing.id, ranked[29].listing.id)
  assert.deepEqual(corrected.slice(30), ranked.slice(30))
  assert.equal(parseRequest({ query: " Ｃ++   .NET " }).query, "c++ .net")
  assert.throws(() => parseRequest({ pageSize: 51 }))
  assert.throws(() => parseRequest({ query: "a".repeat(257) }))
  assert.throws(() => parseRequest({ filters: { status: "deleted" } }))
})

test("eligibility emits precise UTC ranges, all explicit filters, and literal location input", () => {
  const now = new Date("2026-11-28T12:00:00Z")
  const filters = eligibility({
    type: "Job", category: "Engineering", mode: "Remote", location: "x*y",
    timePeriod: "Today", compensation: "hourly-40",
  }, now)
  assert.ok(filters.some(rule => JSON.stringify(rule).includes("2026-11-28T00:00:00.000Z")))
  assert.ok(filters.some(rule => JSON.stringify(rule).includes("USD")))
  assert.ok(filters.some(rule => JSON.stringify(rule).includes("compensation.minimum")))
  const wildcard = filters.find(rule => rule.wildcard)?.wildcard as { locationKey: { value: string } }
  assert.equal(wildcard.locationKey.value, "*x\\*y*")
  assert.match(JSON.stringify(lexicalQuery("machine learning intern", filters)), /"query":"ml"/)
})

test("ingestion validates normalized dates and never guesses compensation or versions", () => {
  assert.equal(intern.deadlineAt, null)
  assert.throws(() => parseListing({ ...cpp, postedAt: "This week" }))
  assert.throws(() => parseListing({ ...cpp, postedAt: "2026-02-30T00:00:00Z" }))
  assert.throws(() => parseListing({ ...cpp, compensation: { minimum: 1000 } }))
  const deleted = parseListing({ id: cpp.id, source: cpp.source, sourceVersion: 2, updatedAt: cpp.updatedAt, status: "deleted" })
  assert.equal("title" in deleted, false)
})

test("server flow handles cache and inference failures, cursor binding, and live eligibility", async t => {
  const original = process.env.SEARCH_RANKING_MODE
  process.env.SEARCH_RANKING_MODE = "rerank"
  t.after(() => {
    if (original === undefined) delete process.env.SEARCH_RANKING_MODE
    else process.env.SEARCH_RANKING_MODE = original
  })
  const docs = new Map(listings.map(item => [item.id, item]))
  const cache = new Map<string, unknown>()
  const embedding = [1, ...Array<number>(383).fill(0)]
  let failEmbed = true
  let failCache = false
  let failRank = true
  let failSearch = false
  let vectorRequests = 0
  let seenFilter: unknown
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input))
    const body = typeof options?.body === "string" ? JSON.parse(options.body) : {}
    if (url.pathname.startsWith("/cache/")) {
      if (failCache) return Response.json({}, { status: 503 })
      const key = decodeURIComponent(url.pathname.split("/").at(-1)!)
      if (options?.method === "PUT") cache.set(key, body.value)
      return Response.json({ value: cache.get(key) ?? null })
    }
    if (url.pathname === "/embed") return failEmbed ? Response.json({}, { status: 503 }) : Response.json({ version: embeddingVersion(), vectors: [embedding] })
    if (url.pathname === "/rerank") return failRank ? Response.json({}, { status: 429 }) : Response.json({ scores: [0, 1, 2] })
    if (url.pathname.endsWith("/_mget")) return Response.json({ docs: body.docs.map(({ _id }: { _id: string }) => ({
      found: docs.has(_id), _source: docs.get(_id),
    })) })
    if (url.pathname.endsWith("/_search")) {
      if (failSearch) return Response.json({}, { status: 503 })
      if (body.query.knn) {
        vectorRequests++
        seenFilter = body.query.knn.embedding.filter
      }
      const hits = body.query.knn ? [dotnet, cpp] : [cpp, dotnet, intern]
      return Response.json({ hits: { hits: hits.map(_source => ({ _source, _score: 1 })) } })
    }
    throw new Error("Unexpected URL " + url)
  })

  const request = parseRequest({ query: "development", pageSize: 1 })
  const first = await search(request, AbortSignal.timeout(1000))
  assert.deepEqual(first.results.map(item => item.id), [cpp.id])
  assert.deepEqual(first.degraded, ["semantic", "reranker"])
  assert.equal(first.count.relation, "bounded")
  assert.ok(first.nextCursor)
  docs.set(dotnet.id, { ...dotnet, sourceVersion: 2 })
  const next = await search({ ...request, cursor: first.nextCursor }, AbortSignal.timeout(1000))
  assert.deepEqual(next.results.map(item => item.id), [intern.id])
  await assert.rejects(search({ ...request, query: "different", cursor: first.nextCursor }, AbortSignal.timeout(1000)), /restart_search/)
  cache.delete("page:" + first.nextCursor)
  await assert.rejects(search({ ...request, cursor: first.nextCursor }, AbortSignal.timeout(1000)), /restart_search/)

  failEmbed = false
  failCache = true
  const filtered = await search({ ...request, filters: { type: "Job", compensation: "annual-80" } }, AbortSignal.timeout(1000))
  assert.ok(filtered.degraded.includes("pagination"))
  assert.equal(filtered.nextCursor, null)
  assert.deepEqual(filtered.results.map(item => item.id), [cpp.id])
  assert.equal(vectorRequests, 1)
  assert.match(JSON.stringify(seenFilter), /embeddingVersion/)
  assert.match(JSON.stringify(seenFilter), /compensation.minimum/)

  docs.set(cpp.id, { ...cpp, status: "closed" })
  assert.equal(await detail(cpp.id, AbortSignal.timeout(1000)), null)
  docs.set(cpp.id, cpp)
  docs.set(dotnet.id, dotnet)
  failRank = false
  const reranked = await search(request, AbortSignal.timeout(1000))
  assert.deepEqual(reranked.results.map(item => item.id), [intern.id])
  failSearch = true
  await assert.rejects(search(request, AbortSignal.timeout(1000)), /opensearch/)
})
