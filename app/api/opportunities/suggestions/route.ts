import { json, respond } from "@/lib/server/search/http"
import { suggest } from "@/lib/server/search/opensearch"
import { normalize, SearchError } from "@/lib/server/search/query"
import { deadline } from "@/lib/server/search/transport"

export async function GET(request: Request) {
  return respond(async () => {
    const query = normalize(new URL(request.url).searchParams.get("q") ?? "")
    if (query.length > 256) throw new SearchError(400, "invalid_query")
    return json({ suggestions: await suggest(query, deadline(200, request.signal)) })
  })
}
