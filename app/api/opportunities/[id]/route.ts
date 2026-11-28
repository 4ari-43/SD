import { json, respond } from "@/lib/server/search/http"
import { detail } from "@/lib/server/search/service"
import { deadline } from "@/lib/server/search/transport"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const item = await detail((await context.params).id, deadline(250, request.signal))
    return item ? json(item) : json({ code: "not_found" }, 404)
  })
}
