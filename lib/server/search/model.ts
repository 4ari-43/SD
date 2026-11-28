import { createHash } from "node:crypto"
import { embeddingModel } from "../../search/contracts.ts"
import { cacheGet, cachePut, deadline, model } from "./transport.ts"

export function embeddingVersion() {
  return `${embeddingModel}@${process.env.EMBEDDING_REVISION ?? "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a"}:listing-v1`
}

export function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 384 && value.every(Number.isFinite)
    && Math.abs(Math.hypot(...value) - 1) < 0.01
}

export async function embeddings(texts: string[], query: boolean, signal: AbortSignal, offline = false) {
  const result = await model<{ version: string; vectors: number[][] }>("/embed", { texts, query }, signal, offline)
  if (result.version !== embeddingVersion() || !Array.isArray(result.vectors)
    || result.vectors.length !== texts.length || !result.vectors.every(isEmbedding)) {
    throw new Error("Unexpected embedding version or vector")
  }
  return result.vectors
}

export async function queryEmbedding(query: string, signal: AbortSignal) {
  if (process.env.SEARCH_EMBED_CACHE === "off") {
    return (await embeddings([query], true, signal))[0]
  }
  const key = "embedding:" + createHash("sha256").update(JSON.stringify([embeddingVersion(), query])).digest("hex")
  let cached: unknown
  try {
    cached = await cacheGet(key, deadline(20, signal))
  } catch {
    // Embedding cache is optional.
  }
  if (isEmbedding(cached)) return cached
  const [embedding] = await embeddings([query], true, signal)
  void cachePut(key, embedding, 86400).catch(() => undefined)
  return embedding
}

export interface Ranker {
  score(query: string, listings: string[], signal: AbortSignal): Promise<number[]>
}

export const neuralRanker: Ranker = {
  async score(query, listings, signal) {
    const result = await model<{ scores: number[] }>("/rerank", { query, listings }, signal)
    return result.scores
  },
}
