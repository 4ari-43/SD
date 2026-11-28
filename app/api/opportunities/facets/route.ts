import { json, respond } from "@/lib/server/search/http"
import { categories } from "@/lib/server/search/opensearch"
import { deadline } from "@/lib/server/search/transport"

export async function GET(request: Request) {
  return respond(async () => json({ categories: await categories(deadline(250, request.signal)) }))
}
