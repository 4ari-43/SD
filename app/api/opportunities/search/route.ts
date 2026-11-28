import { randomUUID } from "node:crypto"
import { json, respond } from "@/lib/server/search/http"
import { parseRequest, SearchError } from "@/lib/server/search/query"
import { search } from "@/lib/server/search/service"
import { deadline } from "@/lib/server/search/transport"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return respond(async () => {
    const requestId = randomUUID()
    const started = performance.now()
    const timings = {}
    const body = await request.json().catch(() => { throw new SearchError(400, "invalid_json") })
    try {
      const result = await search(parseRequest(body), deadline(735, request.signal), requestId, timings)
      console.info(JSON.stringify({
        event: "opportunity_search", requestId, ms: Math.round(performance.now() - started),
        rankingVersion: result.rankingVersion, degraded: result.degraded, timings,
      }))
      return json(result)
    } catch (error) {
      const status = error instanceof SearchError ? error.status : 503
      console.info(JSON.stringify({ event: "opportunity_search_error", requestId, status, ms: Math.round(performance.now() - started), timings }))
      throw error
    }
  })
}
