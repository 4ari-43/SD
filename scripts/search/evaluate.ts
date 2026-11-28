import { readFile } from "node:fs/promises"
import { parseRequest } from "../../lib/server/search/query.ts"
import { search } from "../../lib/server/search/service.ts"

type Judgment = {
  query: string
  filters?: unknown
  split: "tuning" | "held-out"
  category: string
  relevance: Record<string, number>
}

export function metrics(ids: string[], relevance: Record<string, number>) {
  const grades = ids.map(id => relevance[id] ?? 0)
  const positive = Object.values(relevance).filter(grade => grade > 0)
  const dcg = (items: number[]) => items.slice(0, 10).reduce((sum, grade, index) =>
    sum + (2 ** grade - 1) / Math.log2(index + 2), 0)
  const ideal = dcg(positive.sort((a, b) => b - a))
  const first = grades.slice(0, 10).findIndex(grade => grade > 0)
  return {
    recall200: positive.length ? grades.filter(grade => grade > 0).length / positive.length : null,
    ndcg10: ideal ? dcg(grades) / ideal : null,
    mrr10: positive.length ? first >= 0 ? 1 / (first + 1) : 0 : null,
    noResultCorrect: positive.length ? null : Number(ids.length === 0),
  }
}

async function main() {
  const path = process.argv[2]
  if (!path) throw new Error("Usage: pnpm search:evaluate JUDGMENTS.jsonl")
  const rows: Judgment[] = (await readFile(path, "utf8")).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  if (!rows.length) throw new Error("No judgments found")
  for (const row of rows) {
    if (!row.query?.trim() || !["tuning", "held-out"].includes(row.split) || !row.category || !row.relevance
      || Object.values(row.relevance).some(grade => ![0, 1, 2, 3].includes(grade))) throw new Error("Invalid judgment row")
  }
  if (rows.length < 200) console.warn("Smoke evaluation only. Acceptance requires at least 200 representative human judgments.")
  const output: Record<string, unknown> = {}
  for (const mode of ["bm25", "hybrid", "rerank"]) {
    process.env.SEARCH_RANKING_MODE = mode
    const grouped = new Map<string, ReturnType<typeof metrics>[]>()
    let degraded = 0
    for (const row of rows) {
      const query = parseRequest({ query: row.query, filters: row.filters, pageSize: 50 })
      const ids: string[] = []
      let cursor: string | undefined
      let degradedQuery = false
      do {
        const page = await search({ ...query, cursor }, AbortSignal.timeout(1500))
        ids.push(...page.results.map(item => item.id))
        if (page.degraded.length) degradedQuery = true
        cursor = page.nextCursor ?? undefined
      } while (cursor && ids.length < 200)
      if (degradedQuery) degraded++
      const value = metrics(ids, row.relevance)
      for (const key of [row.split, `${row.split}/${row.category}`]) {
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(value)
      }
    }
    output[mode] = {
      degraded,
      groups: Object.fromEntries([...grouped].map(([key, values]) => [key, {
        queries: values.length,
        ...Object.fromEntries((Object.keys(values[0]) as (keyof ReturnType<typeof metrics>)[]).map(metric => {
          const scores = values.flatMap(value => value[metric] === null ? [] : [value[metric]])
          return [metric, scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null]
        })),
      }])),
    }
  }
  console.log(JSON.stringify(output, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
