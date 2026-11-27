import assert from "node:assert/strict"
import test from "node:test"
import { buildOpportunityIndex, searchOpportunityIndex } from "../lib/opportunity-index.ts"
import type { Opportunity } from "../lib/opportunities.ts"
import { filterOpportunities, type Filters } from "../lib/search-opportunities.ts"

const sampleListings: Opportunity[] = [
  {
    id: "cpp-engineer",
    title: "Senior C++ Engineer",
    organization: "OpenAI",
    type: "Job",
    category: "Engineering",
    location: "Dhaka",
    mode: "Remote",
    description: "Build cloud tooling for research teams",
    deadline: "2026-12-31",
    skills: ["TypeScript", "AWS"],
    compensation: "$120k / year",
    posted: "Today",
  },
  {
    id: "cs-intern",
    title: "Computer Science Intern",
    organization: "Example Labs",
    type: "Internship",
    category: "Research",
    location: "Remote",
    mode: "Hybrid",
    description: "Explore data science and coding",
    deadline: "2026-12-15",
    skills: ["Python"],
    compensation: "$30 / hour",
    posted: "This week",
  },
]

const allFilters: Filters = {
  type: "All",
  location: "",
  mode: "Any",
  category: "All fields",
  sort: "Relevance",
  timePeriod: "Any time",
  compensation: "Any",
}

const index = buildOpportunityIndex(sampleListings)

const queryCases: Array<{ label: string; query: string }> = [
  { label: "partial words", query: "ngine" },
  { label: "multiple terms", query: "cloud TOOL" },
  { label: "mixed case", query: "cOmPuTeR sCiEnCe" },
  { label: "special characters", query: "C++" },
  { label: "short punctuation", query: "++" },
  { label: "empty query", query: "  " },
  { label: "nonmatching query", query: "C+ Engineer" },
]

for (const { label, query } of queryCases) {
  test(`indexed search matches current search for ${label}`, () => {
    const indexed = searchOpportunityIndex(index, query).map((item) => item.id)
    const current = filterOpportunities(sampleListings, query, allFilters).map((item) => item.id)
    assert.deepEqual(indexed, current)
  })
}

test("empty index returns no results", () => {
  assert.deepEqual(searchOpportunityIndex(buildOpportunityIndex([]), "anything"), [])
})
