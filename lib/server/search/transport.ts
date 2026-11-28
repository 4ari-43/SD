export class UpstreamError extends Error {
  readonly service: string
  readonly status: number

  constructor(service: string, status: number) {
    super(`${service} returned HTTP ${status}`)
    this.service = service
    this.status = status
  }
}

export function deadline(ms: number, parent?: AbortSignal) {
  const timeout = AbortSignal.timeout(ms)
  return parent ? AbortSignal.any([parent, timeout]) : timeout
}

export function indexName() {
  const name = process.env.OPENSEARCH_INDEX ?? "opportunities"
  if (!/^[a-z][a-z0-9_-]{0,127}$/.test(name)) throw new Error("Invalid OPENSEARCH_INDEX")
  return name
}

async function request<T>(service: string, base: string, path: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const response = await fetch(base.replace(/\/$/, "") + path, { ...init, signal, cache: "no-store" })
  if (!response.ok) throw new UpstreamError(service, response.status)
  return response.json() as Promise<T>
}

export function openSearch<T>(path: string, method = "GET", body?: unknown, signal = deadline(250), ndjson = false) {
  const base = process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200"
  const headers: Record<string, string> = { "Content-Type": ndjson ? "application/x-ndjson" : "application/json" }
  if (process.env.OPENSEARCH_USER && process.env.OPENSEARCH_PASSWORD) {
    headers.Authorization = "Basic " + Buffer.from(`${process.env.OPENSEARCH_USER}:${process.env.OPENSEARCH_PASSWORD}`).toString("base64")
  }
  return request<T>("opensearch", base, path, {
    method, headers, body: body === undefined ? undefined : ndjson ? String(body) : JSON.stringify(body),
  }, signal)
}

export function model<T>(path: string, body: unknown, signal: AbortSignal, offline = false) {
  const base = offline
    ? process.env.INGEST_EMBED_URL ?? "http://127.0.0.1:8002"
    : process.env.INFERENCE_URL ?? "http://127.0.0.1:8001"
  return request<T>("inference", base, path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }, signal)
}

export async function cacheGet<T>(key: string, signal = deadline(35)): Promise<T | null> {
  const response = await request<{ value: T | null }>("cache", process.env.SEARCH_CACHE_URL ?? "http://127.0.0.1:8003",
    `/cache/${encodeURIComponent(key)}`, {}, signal)
  return response.value
}

export async function cachePut(key: string, value: unknown, ttl: number, signal = deadline(35)) {
  await request("cache", process.env.SEARCH_CACHE_URL ?? "http://127.0.0.1:8003",
    `/cache/${encodeURIComponent(key)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value, ttl }),
    }, signal)
}
