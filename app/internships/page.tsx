import type { Metadata } from "next"
import { OpportunityFinder } from "@/components/opportunity-finder"

export const metadata: Metadata = {
  title: "Internships | Pathfinder",
}

export default function InternshipsPage() {
  return <OpportunityFinder initialType="Internship" />
}
