"use client"

import { useEffect, useRef, useState } from "react"
import type { SearchRequest, SearchResponse } from "@/lib/search/contracts"

async function request(body: Omit<SearchRequest, "cursor">, signal: AbortSignal, cursor?: string) {
  const response = await fetch("/api/opportunities/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, cursor }),
    signal,
  })
  if (!response.ok) throw new Error(response.status === 410 ? "expired" : "unavailable")
  return response.json() as Promise<SearchResponse>
}

type State = {
  key: string
  data?: SearchResponse
  error?: "first" | "more" | "expired"
  loadingMore?: boolean
}

export function useOpportunitySearch(input: Omit<SearchRequest, "cursor">, active: boolean, sequence: number) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<State>()
  const body = JSON.stringify(input)
  const key = JSON.stringify([active, sequence, retry, body])
  const inFlight = useRef<{ key: string; controller: AbortController; pending: boolean } | null>(null)
  const current = state?.key === key ? state : undefined

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const context = { key, controller, pending: true }
    inFlight.current = context
    const timer = setTimeout(() => {
      request(JSON.parse(body), controller.signal).then(data => {
        if (!controller.signal.aborted) setState({ key, data })
      }).catch(() => {
        if (!controller.signal.aborted) setState({ key, error: "first" })
      }).finally(() => { context.pending = false })
    }, 120)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, body, key])

  async function loadMore() {
    const data = current?.data
    const context = inFlight.current
    if (!data?.nextCursor || !context || context.key !== key || context.pending) return
    context.pending = true
    setState({ key, data, loadingMore: true })
    try {
      const page = await request(input, context.controller.signal, data.nextCursor)
      if (context.controller.signal.aborted) return
      setState({ key, data: { ...page, results: [...data.results, ...page.results] } })
    } catch (error) {
      if (!context.controller.signal.aborted) {
        setState({ key, data, error: error instanceof Error && error.message === "expired" ? "expired" : "more" })
      }
    } finally {
      context.pending = false
    }
  }

  return { ...current, loading: active && !current, loadMore, restart: () => setRetry(value => value + 1) }
}

export function useOpportunitySuggestions(query: string, active: boolean) {
  const [answer, setAnswer] = useState<{ query: string; suggestions: string[] }>()
  const value = query.trim()
  useEffect(() => {
    if (!active || !value) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/opportunities/suggestions?q=" + encodeURIComponent(value), { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (!controller.signal.aborted) setAnswer({ query: value, suggestions: data.suggestions })
      } catch {
        // Suggestions are optional. Enter still submits the typed query.
      }
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [active, value])
  return active && answer?.query === value ? answer.suggestions : []
}
