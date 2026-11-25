export type OpportunityType = "Job" | "Internship" | "Scholarship"
export type Opportunity = {
  id: string
  title: string
  organization: string
  type: OpportunityType
  category: string
  location: string
  mode: "Remote" | "On-site" | "Hybrid"
  description: string
  deadline: string
  skills: string[]
  compensation: string
  posted: string
}

// Placeholder listings stay disabled until a database is connected.
export const opportunities: Opportunity[] = []

export const popularSearches = ["Coding", "Computer Science", "Cybersecurity", "Cloud Computing", "Data Science", "AI & Machine Learning", "Web Development", "Engineering", "Research", "Business", "Internship", "Fully Funded"]
