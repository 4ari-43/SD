import { candidateLimit, rerankLimit, type IndexedOpportunity } from "../../search/contracts.ts"

export type Candidate = {
  listing: Pick<IndexedOpportunity, "id" | "sourceVersion" | "canonicalKey" | "postedAt">
  score: number
}
export type Ranked = Candidate & {
  branches: { rank: number; score: number }[]
}

export function fuse(branches: Candidate[][]): Ranked[] {
  const all = new Map<string, Ranked>()
  for (const branch of branches) {
    const seen = new Set<string>()
    branch.forEach(({ listing, score }, index) => {
      const key = listing.canonicalKey
      if (seen.has(key)) return
      seen.add(key)
      const rank = index + 1
      const entry = all.get(key)
      if (entry) {
        entry.score += 1 / (60 + rank)
        entry.branches.push({ rank, score })
      } else {
        all.set(key, { listing, score: 1 / (60 + rank), branches: [{ rank, score }] })
      }
    })
  }
  return [...all.values()].sort((a, b) => b.score - a.score
    || Date.parse(b.listing.postedAt ?? "1970-01-01") - Date.parse(a.listing.postedAt ?? "1970-01-01")
    || (a.listing.id < b.listing.id ? -1 : a.listing.id === b.listing.id ? 0 : 1)).slice(0, candidateLimit)
}

export function applyRerank(ranked: Ranked[], scores: number[]) {
  const head = ranked.slice(0, rerankLimit)
  if (scores.length !== head.length || scores.some(score => !Number.isFinite(score))) {
    throw new Error("Invalid reranker output")
  }
  return [
    ...head.map((hit, index) => ({ hit, index })).sort((a, b) => scores[b.index] - scores[a.index] || a.index - b.index)
      .map(({ hit }) => hit),
    ...ranked.slice(rerankLimit),
  ]
}

export function listingText(item: IndexedOpportunity) {
  return [item.title, item.skills.join(", "), item.organization, item.category, item.location, item.description]
    .filter(Boolean).join("\n").slice(0, 12000)
}
