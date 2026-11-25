import type { Metadata } from "next"
import { OpportunityFinder } from "@/components/opportunity-finder"

export const metadata: Metadata = {
  title: "Jobs | Pathfinder",
}

export default function JobsPage() {
  return <OpportunityFinder initialType="Job" />
}
