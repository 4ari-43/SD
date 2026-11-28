"use client"

import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export default function OpportunityDetailError({ reset }: { reset: () => void }) {
  return <main className="opportunity-detail-page">
    <SiteHeader />
    <section className="opportunity-detail-shell">
      <div className="empty-results" role="alert">
        <h2>This opportunity could not be loaded</h2>
        <button onClick={reset}>Try again</button>
        <Link className="detail-back-link" href="/">Back to search</Link>
      </div>
    </section>
  </main>
}
