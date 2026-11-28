import { createHash } from "node:crypto"
import { modes, types, type IndexedOpportunity } from "../../search/contracts.ts"
import { embeddingVersion, embeddings } from "./model.ts"
import { isListingId, normalize } from "./query.ts"
import { listingText } from "./ranking.ts"
import { deadline, indexName, openSearch, UpstreamError } from "./transport.ts"

const keyword = { type: "keyword" }
const date = { type: "date", format: "strict_date_time" }
const prefix = { type: "text", analyzer: "label_prefix", search_analyzer: "label" }
const textField = { type: "text", analyzer: "opportunity_text" }
export const mapping = {
  settings: {
    number_of_shards: Number(process.env.OPENSEARCH_SHARDS ?? 1),
    number_of_replicas: Number(process.env.OPENSEARCH_REPLICAS ?? 0),
    "index.knn": true,
    max_ngram_diff: 63,
    analysis: {
      tokenizer: {
        technical_terms: { type: "pattern", pattern: "[\\p{L}\\p{N}]+(?:[+#]+)?|\\.[\\p{L}\\p{N}]+", group: 0 },
      },
      filter: { prefix_edges: { type: "edge_ngram", min_gram: 1, max_gram: 64 } },
      analyzer: {
        opportunity_text: { type: "custom", tokenizer: "technical_terms", filter: ["lowercase"] },
        label_prefix: { type: "custom", tokenizer: "keyword", filter: ["lowercase", "prefix_edges"] },
        label: { type: "custom", tokenizer: "keyword", filter: ["lowercase"] },
      },
    },
  },
  mappings: {
    dynamic: "strict",
    properties: {
      id: keyword, source: keyword, sourceVersion: { type: "long" }, canonicalUrl: { type: "keyword", index: false },
      canonicalKey: keyword, title: { ...textField, fields: { prefix } }, organization: textField,
      type: { ...keyword, fields: { text: textField } }, category: { ...keyword, fields: { text: textField, prefix } },
      location: textField, locationKey: { type: "wildcard" }, mode: keyword, description: textField,
      skills: { ...textField, fields: { prefix } }, skillKeys: keyword,
      postedAt: date, updatedAt: date, deadlineAt: date, status: keyword, contentHash: keyword, embeddingVersion: keyword,
      compensation: { properties: {
        label: { type: "keyword", index: false }, minimum: { type: "double" }, maximum: { type: "double" },
        currency: keyword, period: keyword, funding: { type: "boolean" },
      } },
      embedding: { type: "knn_vector", dimension: 384, method: {
        name: "hnsw", engine: "lucene", space_type: "cosinesimil", parameters: { m: 16, ef_construction: 100 },
      } },
    },
  },
}

type Tombstone = Pick<IndexedOpportunity, "id" | "source" | "sourceVersion" | "updatedAt"> & { status: "deleted" }
export type IndexWrite = IndexedOpportunity | Tombstone

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object")
  return value as Record<string, unknown>
}

function string(value: unknown, name: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`)
  return value.trim().normalize("NFKC").replace(/\s+/g, " ")
}

function timestamp(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new Error(`Invalid ${name}: use a full ISO 8601 timestamp with timezone`)
  }
  return new Date(value).toISOString()
}

function amount(value: unknown, name: string) {
  if (value == null) return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name}`)
  return value
}

export function parseListing(raw: unknown): IndexWrite {
  const input = record(raw)
  const id = string(input.id, "id", 128)
  const source = string(input.source, "source", 128)
  const sourceVersion = input.sourceVersion
  if (!isListingId(id)) throw new Error("Invalid or reserved id")
  if (typeof sourceVersion !== "number" || !Number.isSafeInteger(sourceVersion) || sourceVersion < 1) throw new Error("Invalid sourceVersion")
  const updatedAt = timestamp(input.updatedAt, "updatedAt")
  const status = input.status
  if (status === "deleted") return { id, source, sourceVersion, updatedAt, status }
  if (status !== "active" && status !== "closed") throw new Error("Invalid status")

  const type = input.type as IndexedOpportunity["type"]
  const mode = input.mode as IndexedOpportunity["mode"]
  if (!types.includes(type) || !modes.includes(mode)) throw new Error("Invalid type or mode")
  if (!Array.isArray(input.skills) || input.skills.length > 50) throw new Error("Invalid skills")
  const skills = [...new Set(input.skills.map(skill => string(skill, "skill", 100)))]
  const location = string(input.location, "location", 250)
  const rawComp = input.compensation == null ? {} : record(input.compensation)
  const minimum = amount(rawComp.minimum, "compensation.minimum")
  const maximum = amount(rawComp.maximum, "compensation.maximum")
  const currency = rawComp.currency == null ? undefined : string(rawComp.currency, "currency", 3).toUpperCase()
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid currency")
  const period = rawComp.period as IndexedOpportunity["compensation"]["period"]
  if (period !== undefined && !["hour", "year", "month", "one-time"].includes(period)) throw new Error("Invalid compensation period")
  if (rawComp.funding !== undefined && typeof rawComp.funding !== "boolean") throw new Error("Invalid funding flag")
  if ((minimum !== undefined || maximum !== undefined) && (!period || !currency)) throw new Error("Amount requires currency and period")
  if (minimum !== undefined && maximum !== undefined && maximum < minimum) throw new Error("Invalid compensation range")

  let canonicalUrl: string | undefined
  if (input.canonicalUrl != null) {
    const url = new URL(string(input.canonicalUrl, "canonicalUrl", 2048))
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid canonicalUrl")
    url.hash = ""
    canonicalUrl = url.href
  }
  const identity = input.canonicalKey == null ? canonicalUrl ?? `${source}:${id}` : string(input.canonicalKey, "canonicalKey", 300)
  const listing: IndexedOpportunity = {
    id, source, sourceVersion, updatedAt, status, type, mode, skills, location, canonicalUrl,
    canonicalKey: createHash("sha256").update(identity).digest("hex"),
    title: string(input.title, "title", 250),
    organization: string(input.organization, "organization", 250),
    category: string(input.category, "category", 100),
    description: string(input.description, "description", 40000),
    postedAt: input.postedAt == null ? null : timestamp(input.postedAt, "postedAt"),
    deadlineAt: input.deadlineAt == null ? null : timestamp(input.deadlineAt, "deadlineAt"),
    compensation: { label: rawComp.label == null ? "Compensation not listed" : string(rawComp.label, "compensation.label", 250),
      minimum, maximum, currency, period, funding: rawComp.funding === true },
    locationKey: normalize(location),
    skillKeys: [...new Set(skills.map(normalize))],
    contentHash: "",
  }
  listing.contentHash = createHash("sha256").update(listingText(listing)).digest("hex")
  return listing
}

const upsertScript = `
if (ctx.op == 'create') {
  ctx._source = params.doc;
} else if (ctx._source.source != params.doc.source || ctx._source.sourceVersion >= params.doc.sourceVersion) {
  ctx.op = 'noop';
} else {
  if (params.doc.status != 'deleted' && ctx._source.contentHash == params.doc.contentHash && ctx._source.containsKey('embedding')) {
    params.doc.embedding = ctx._source.embedding;
    params.doc.embeddingVersion = ctx._source.embeddingVersion;
  }
  ctx._source = params.doc;
}`

const backfillScript = `
if (ctx._source.status == 'active' && ctx._source.sourceVersion == params.version && ctx._source.contentHash == params.hash && ctx._source.embeddingVersion != params.model) {
  ctx._source.embedding = params.vector;
  ctx._source.embeddingVersion = params.model;
} else {
  ctx.op = 'noop';
}`

type BulkResult = { items: { update: { status: number; result?: string; error?: { reason?: string } } }[] }

async function bulk(entries: { id: string; update: object }[], target: string) {
  if (!entries.length) return 0
  const body = entries.map(({ id, update }) =>
    JSON.stringify({ update: { _id: id, retry_on_conflict: 3 } }) + "\n" + JSON.stringify(update) + "\n").join("")
  const result = await openSearch<BulkResult>(`/${target}/_bulk${target === indexName() ? "?require_alias=true" : ""}`, "POST", body, deadline(30000), true)
  const failures = result.items.filter(row => row.update.status >= 300)
  if (failures.length) throw new Error(`${failures.length} bulk updates failed: ${failures[0].update.error?.reason ?? failures[0].update.status}`)
  return result.items.filter(row => row.update.result !== "noop").length
}

export function upsertListings(items: IndexWrite[], target = indexName()) {
  return bulk(items.map(doc => ({
    id: doc.id,
    update: { scripted_upsert: true, upsert: {}, script: { lang: "painless", source: upsertScript, params: { doc } } },
  })), target)
}

export async function backfillEmbeddings(target = indexName()) {
  const version = embeddingVersion()
  let after: string[] | undefined
  let updated = 0
  while (true) {
    const response: { hits: { hits: { _source: IndexedOpportunity; sort: string[] }[] } } = await openSearch(`/${target}/_search?allow_partial_search_results=false`, "POST", {
      size: 16, track_total_hits: false, _source: { excludes: ["embedding"] },
      sort: [{ id: "asc" }], ...(after && { search_after: after }),
      query: { bool: { filter: { term: { status: "active" } }, must_not: { term: { embeddingVersion: version } } } },
    }, deadline(10000))
    const hits = response.hits.hits
    if (!hits.length) {
      if (updated) await openSearch(`/${target}/_refresh`, "POST", undefined, deadline(30000))
      return updated
    }
    const vectors = await embeddings(hits.map(hit => listingText(hit._source)), false, deadline(30000), true)
    updated += await bulk(hits.map(({ _source: doc }, i) => ({
      id: doc.id,
      update: { script: { lang: "painless", source: backfillScript, params: {
        version: doc.sourceVersion, hash: doc.contentHash, model: version, vector: vectors[i],
      } } },
    })), target)
    after = hits[hits.length - 1].sort
  }
}

export function versionedIndex(value: string) {
  if (!/^[a-z][a-z0-9_-]{0,127}$/.test(value) || value === indexName()) throw new Error("Provide a physical index name distinct from the alias")
  return value
}

export async function promote(target: string) {
  let previous: string[] = []
  try {
    previous = Object.keys(await openSearch<object>("/_alias/" + indexName(), "GET", undefined, deadline(10000)))
  } catch (error) {
    if (!(error instanceof UpstreamError) || error.status !== 404) throw error
  }
  await openSearch("/_aliases", "POST", {
    actions: [...previous.filter(index => index !== target).map(index => ({ remove: { index, alias: indexName() } })),
      { add: { index: target, alias: indexName(), is_write_index: true } }],
  }, deadline(10000))
}
