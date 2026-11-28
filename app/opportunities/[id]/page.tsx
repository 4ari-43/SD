import { ArrowLeft, Clock3, MapPin } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { detail } from "@/lib/server/search/service"
import { deadline as requestDeadline } from "@/lib/server/search/transport"
import { formatListingDate } from "@/lib/search/dates"

export const dynamic = "force-dynamic"

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const opportunity = await detail(id, requestDeadline(250))

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
              <dd><Clock3 size={15} />{opportunity.deadlineAt ? formatListingDate(opportunity.deadlineAt, true) : "Not listed"}</dd>
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
          {opportunity.postedAt && <p className="detail-updated">Posted {formatListingDate(opportunity.postedAt, true)}</p>}
        </article>
      </section>
    </main>
  )
}
