import type { Opportunity } from "./opportunities"

/**
 * A substring-preserving search index for opportunity listings.
 *
 * The current search behavior treats each whitespace-separated query term as
 * an arbitrary substring (rather than a whole word) and ANDs those terms.
 * Trigram postings narrow longer queries; queries shorter than three
 * characters use the full listing set so punctuation and partial words keep
 * exactly the same behavior.
 */
export type OpportunityIndex = {
  items: Opportunity[]
  searchableText: string[]
  trigrams: Map<string, Set<number>>
}

function searchableText(item: Opportunity): string {
  return [
    item.title,
    item.organization,
    item.type,
    item.category,
    item.location,
    item.description,
    ...item.skills,
  ].join(" ").toLowerCase()
}

function getTrigrams(value: string): Set<string> {
  const grams = new Set<string>()
  for (let i = 0; i <= value.length - 3; i += 1) {
    grams.add(value.slice(i, i + 3))
  }
  return grams
}

export function buildOpportunityIndex(items: Opportunity[]): OpportunityIndex {
  const texts = items.map(searchableText)
  const trigrams = new Map<string, Set<number>>()

  texts.forEach((text, itemIndex) => {
    for (const gram of getTrigrams(text)) {
      let postings = trigrams.get(gram)
      if (!postings) {
        postings = new Set<number>()
        trigrams.set(gram, postings)
      }
      postings.add(itemIndex)
    }
  })

  return { items: [...items], searchableText: texts, trigrams }
}

export function searchOpportunityIndex(index: OpportunityIndex, query: string): Opportunity[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...index.items]

  let candidates: Set<number> | undefined
  for (const term of terms) {
    if (term.length < 3) continue

    let termCandidates: Set<number> | undefined
    for (const gram of getTrigrams(term)) {
      const postings = index.trigrams.get(gram)
      if (!postings) {
        termCandidates = new Set<number>()
        break
      }
      termCandidates = termCandidates === undefined
        ? new Set(postings)
        : new Set([...termCandidates].filter((itemIndex) => postings.has(itemIndex)))
      if (termCandidates.size === 0) break
    }

    candidates = candidates === undefined
      ? termCandidates
      : new Set([...candidates].filter((itemIndex) => termCandidates!.has(itemIndex)))
    if (candidates?.size === 0) return []
  }

  const possible = candidates ?? new Set(index.items.map((_, itemIndex) => itemIndex))
  return [...possible]
    .filter((itemIndex) => terms.every((term) => index.searchableText[itemIndex].includes(term)))
    .sort((a, b) => a - b)
    .map((itemIndex) => index.items[itemIndex])
}
