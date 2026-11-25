import { ArrowLeft, Clock3, MapPin } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { opportunities } from "@/lib/opportunities"

export async function generateStaticParams() {
  return opportunities.map(({ id }) => ({ id }))
}

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const opportunity = opportunities.find((item) => item.id === id)

  if (!opportunity) notFound()

  const typeClass = opportunity.type === "Job"
    ? "badge-job"
    : opportunity.type === "Internship"
      ? "badge-internship"
      : "badge-scholarship"
  const categoryPath = opportunity.type === "Job"
    ? "/jobs"
    : opportunity.type === "Internship"
      ? "/internships"
      : "/scholarships"
  const deadline = new Date(`${opportunity.deadline}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <main className="opportunity-detail-page">
      <SiteHeader />
      <section className="opportunity-detail-shell">
        <Link href={categoryPath} className="detail-back-link">
          <ArrowLeft size={16} />
          Back to {opportunity.type.toLowerCase()}s
        </Link>
        <article className="opportunity-detail-card">
          <div className="detail-card-top">
            <div className={`org-avatar org-${opportunity.organization.charAt(0).toLowerCase()}`}>
              {opportunity.organization.charAt(0)}
            </div>
            <span className={`type-badge ${typeClass}`}>{opportunity.type}</span>
          </div>
          <p className="detail-organization">{opportunity.organization}</p>
          <h1>{opportunity.title}</h1>
          <p className="detail-description">{opportunity.description}</p>

          <dl className="detail-facts">
            <div>
              <dt>Location</dt>
              <dd><MapPin size={15} />{opportunity.location}</dd>
            </div>
            <div>
              <dt>Work mode</dt>
              <dd>{opportunity.mode}</dd>
            </div>
            <div>
              <dt>Compensation</dt>
              <dd>{opportunity.compensation}</dd>
            </div>
            <div>
              <dt>Apply by</dt>
              <dd><Clock3 size={15} />{deadline}</dd>
            </div>
          </dl>

          <section className="detail-skills">
            <h2>Skills &amp; focus</h2>
            <div className="tag-row">
              {opportunity.skills.map((skill) => (
                <span className="skill-tag" key={skill}>{skill}</span>
              ))}
            </div>
          </section>
          <p className="detail-updated">Posted {opportunity.posted}</p>
        </article>
      </section>
    </main>
  )
}
