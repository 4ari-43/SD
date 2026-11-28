import { SearchError } from "./query.ts"

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function respond(action: () => Promise<Response>) {
  try {
    return await action()
  } catch (error) {
    if (error instanceof SearchError) return json({ code: error.code }, error.status)
    console.error("opportunity_backend_error", error instanceof Error ? error.message : "Unknown error")
    return json({ code: "search_unavailable" }, 503)
  }
}
