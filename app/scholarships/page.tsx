import type { Metadata } from "next"
import { OpportunityFinder } from "@/components/opportunity-finder"

export const metadata: Metadata = {
  title: "Scholarships | Pathfinder",
}

export default function ScholarshipsPage() {
  return <OpportunityFinder initialType="Scholarship" />
}
