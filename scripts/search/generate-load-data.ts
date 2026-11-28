import { once } from "node:events"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

const roles = [
  { title: "Backend Engineer", type: "Job", category: "Engineering", skills: ["TypeScript", "PostgreSQL"], description: "Build APIs, tune database queries, and improve service reliability." },
  { title: "Machine Learning Intern", type: "Internship", category: "Data Science", skills: ["Python", "Computer vision"], description: "Prepare datasets, train classifiers, and evaluate performance on image labeling tasks." },
  { title: "Graduate Computing Scholarship", type: "Scholarship", category: "Education", skills: ["Computer Science", "Research"], description: "Covers tuition and living expenses for graduate students researching computing." },
  { title: "C++ Systems Engineer", type: "Job", category: "Engineering", skills: ["C++", "Linux"], description: "Design low-latency systems and profile native applications on Linux." },
  { title: "C# Software Developer", type: "Job", category: "Engineering", skills: ["C#", ".NET"], description: "Build tools for logistics teams and maintain integrations with inventory systems." },
] as const
const locations = ["Dhaka, Bangladesh", "Toronto, Canada", "London, UK", "New York, USA", "Singapore"]
const modes = ["Remote", "Hybrid", "On-site"] as const
const projects = ["Payments", "Accessibility", "Cloud infrastructure", "Education", "Analytics", "Computer vision", "Network reliability", "Security", "Developer tools", "Operations"]

async function main() {
  const dir = process.argv[2] ?? "data/local"
  const size = Number(process.argv[3] ?? 100000)
  if (!Number.isSafeInteger(size) || size < 1 || size > 1000000) throw new Error("Size must be between 1 and 1,000,000")
  await mkdir(dir, { recursive: true })
  // Do not overwrite a dataset or query file accidentally.
  const listings = createWriteStream(join(dir, "load-listings.jsonl"), { flags: "wx" })
  const finished = once(listings, "finish")
  const now = Date.now()
  try {
    for (let i = 0; i < size; i++) {
      const role = roles[i % roles.length]
      const project = projects[Math.floor(i / roles.length) % projects.length]
      const location = locations[Math.floor(i / 50) % locations.length]
      const mode = modes[Math.floor(i / 250) % modes.length]
      const postedAt = new Date(now - (i % 45) * 86400000).toISOString()
      const description = [
        role.description,
        `The ${project} team works with colleagues in ${location}. Candidates should explain how they solved a practical problem with ${role.skills.join(" or ")}.`,
        i % 3 ? "Applicants can include work samples, reports, or projects. The team provides regular mentoring and reviews." : "The review process includes a written statement, references, and a discussion of previous projects.",
      ].join(" ")
      const line = JSON.stringify({
        ...role, description, location, mode, id: `load-${i}`, source: "synthetic-load", sourceVersion: 1,
        organization: `Example Organization ${i % 1400}`, title: `${role.title} - ${project}`, status: "active",
        postedAt, updatedAt: postedAt, deadlineAt: i % 5 ? new Date(now + ((i % 31) + 1) * 86400000).toISOString() : null,
        compensation: role.type === "Scholarship" ? { label: "Tuition support", funding: true }
          : role.type === "Internship" ? { label: "USD 24/hour", currency: "USD", period: "hour", minimum: 24 }
          : { label: "USD 96,000/year", currency: "USD", period: "year", minimum: 96000 },
      }) + "\n"
      if (!listings.write(line)) await once(listings, "drain")
    }
    listings.end()
    await finished
  } catch (error) {
    listings.destroy()
    await finished.catch(() => undefined)
    throw error
  }

  const queries = createWriteStream(join(dir, "load-queries.jsonl"), { flags: "wx" })
  const done = once(queries, "finish")
  for (const role of roles) for (const [index, project] of projects.entries()) for (const location of locations) {
    queries.write(JSON.stringify({
      query: index % 3 ? `${role.title} ${project} ${location}` : `${role.skills.at(-1)} ${project}`,
      filters: { type: role.type, ...(index % 2 ? { location } : {}), ...(index % 4 === 0 ? { timePeriod: "Past 7 days" } : {}) },
      sort: index % 5 === 0 ? "Newest" : index % 7 === 0 ? "Deadline" : "Relevance",
    }) + "\n")
  }
  queries.end()
  await done
  console.log(`Wrote ${size} synthetic listings and 250 query/filter combinations to ${dir}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
