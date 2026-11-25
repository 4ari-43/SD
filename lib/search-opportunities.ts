import type { Opportunity } from "./opportunities"

export type Filters = {
  type: string
  location: string
  mode: string
  category: string
  sort: string
  timePeriod: string
  compensation: string
}

// Replace this in-memory provider with a REST/API request when a backend is ready.
export async function getOpportunities(): Promise<Opportunity[]> {
  return import("./opportunities").then(({ opportunities }) => opportunities)
}

export function filterOpportunities(items: Opportunity[], query: string, filters: Filters) {
  const normalized = query.trim().toLowerCase()
  const filtered = items.filter((item) => {
    const text = [item.title, item.organization, item.type, item.category, item.location, item.description, ...item.skills].join(" ").toLowerCase()
    const matchesQuery = !normalized || normalized.split(/\s+/).every((word) => text.includes(word))
    const postedDaysAgo = item.posted === "Today"
      ? 0
      : item.posted === "This week"
        ? 7
        : Number(item.posted.match(/^(\d+)\s+days?\s+ago$/)?.[1] ?? Infinity)
    const amountMatch = item.compensation.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k)?/i)
    const amount = amountMatch
      ? Number(amountMatch[1].replace(/,/g, "")) * (amountMatch[2] ? 1000 : 1)
      : 0
    const compensation = item.compensation.toLowerCase()
    const matchesTimePeriod = filters.timePeriod === "Any time"
      || (filters.timePeriod === "Today" && postedDaysAgo === 0)
      || (filters.timePeriod === "Past 7 days" && postedDaysAgo <= 7)
      || (filters.timePeriod === "Past 30 days" && postedDaysAgo <= 30)
    const matchesCompensation = filters.compensation === "Any"
      || (filters.compensation === "hourly-40" && compensation.includes("/ hour") && amount >= 40)
      || (filters.compensation === "annual-80" && compensation.includes("/ year") && amount >= 80000)
      || (filters.compensation === "funding" && (
        item.type === "Scholarship" || /tuition|stipend|\/ month/.test(compensation)
      ))
    return matchesQuery && (filters.type === "All" || item.type === filters.type)
      && (!filters.location || item.location.toLowerCase().includes(filters.location.toLowerCase()))
      && (filters.mode === "Any" || item.mode === filters.mode)
      && (filters.category === "All fields" || item.category === filters.category)
      && matchesTimePeriod
      && matchesCompensation
  })
  if (filters.sort === "Deadline") return filtered.sort((a, b) => a.deadline.localeCompare(b.deadline))
  if (filters.sort === "Newest") return filtered.sort((a, b) => a.posted.localeCompare(b.posted))
  return filtered
}

export function getSuggestions(items: Opportunity[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const candidates = new Set<string>()
  for (const item of items) {
    candidates.add(item.title)
    candidates.add(item.category)
    item.skills.forEach((skill) => candidates.add(skill))
    candidates.add(item.type === "Scholarship" ? "Scholarship" : `${item.type} opportunities`)
  }
  // Popular terms supplement dataset-derived labels while still being truly query-filtered.
  for (const term of ["Coding", "Computer Science", "Computer Engineering", "Cybersecurity", "Cloud Computing", "Data Science", "AI & Machine Learning", "Web Development", "Fully Funded Scholarships"]) candidates.add(term)
  return [...candidates].filter((value) => value.toLowerCase().includes(q)).sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts || a.localeCompare(b)
  }).slice(0, 7)
}
