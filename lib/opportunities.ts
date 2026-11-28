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

export const opportunities: Opportunity[] = [
  {
    id: "software-engineer-google",
    title: "Software Engineer",
    organization: "Google",
    type: "Job",
    category: "Engineering",
    location: "Remote",
    mode: "Remote",
    description: "Build and improve products used by billions. Work on cutting-edge technologies across a global team.",
    deadline: "2026-12-20",
    skills: ["JavaScript", "Distributed Systems", "Python"],
    compensation: "$120k - $180k / year",
    posted: "2 days ago",
  },
  {
    id: "frontend-developer-amazon",
    title: "Frontend Developer",
    organization: "Amazon",
    type: "Job",
    category: "Engineering",
    location: "Seattle, WA",
    mode: "On-site",
    description: "Join our team to build innovative shopping experiences for customers around the world.",
    deadline: "2026-12-18",
    skills: ["React", "TypeScript", "AWS"],
    compensation: "$105k - $155k / year",
    posted: "1 day ago",
  },
  {
    id: "product-manager-microsoft",
    title: "Product Manager",
    organization: "Microsoft",
    type: "Job",
    category: "Product",
    location: "Redmond, WA",
    mode: "Hybrid",
    description: "Lead the development of next-generation products and turn ambitious ideas into practical outcomes.",
    deadline: "2026-12-29",
    skills: ["Strategy", "Analytics", "Leadership"],
    compensation: "$130k - $175k / year",
    posted: "3 days ago",
  },
  {
    id: "ux-designer-figma",
    title: "Product Designer",
    organization: "Figma",
    type: "Job",
    category: "Design",
    location: "San Francisco, CA",
    mode: "Hybrid",
    description: "Shape thoughtful, accessible design tools used by creative teams around the world.",
    deadline: "2027-01-08",
    skills: ["Figma", "User Research", "Design Systems"],
    compensation: "$115k - $160k / year",
    posted: "Today",
  },
  {
    id: "data-science-intern-netflix",
    title: "Data Science Intern",
    organization: "Netflix",
    type: "Internship",
    category: "Data",
    location: "Los Angeles, CA",
    mode: "Hybrid",
    description: "Explore member behavior and build models that help personalize entertainment experiences.",
    deadline: "2027-01-15",
    skills: ["Python", "SQL", "Machine Learning"],
    compensation: "$45 / hour",
    posted: "This week",
  },
  {
    id: "cloud-intern-ibm",
    title: "Cloud Engineering Intern",
    organization: "IBM",
    type: "Internship",
    category: "Engineering",
    location: "Austin, TX",
    mode: "On-site",
    description: "Work alongside cloud engineers to design reliable infrastructure and modern developer tools.",
    deadline: "2027-01-20",
    skills: ["Cloud", "Linux", "Automation"],
    compensation: "$38 / hour",
    posted: "5 days ago",
  },
  {
    id: "merit-scholarship-stanford",
    title: "Future Leaders Merit Scholarship",
    organization: "Stanford",
    type: "Scholarship",
    category: "Education",
    location: "United States",
    mode: "On-site",
    description: "A merit-based award supporting exceptional students pursuing technology and science degrees.",
    deadline: "2027-02-01",
    skills: ["Leadership", "STEM", "Community"],
    compensation: "$25,000 tuition award",
    posted: "This week",
  },
]

export const popularSearches = ["Coding", "Computer Science", "Cybersecurity", "Cloud Computing", "Data Science", "AI & Machine Learning", "Web Development", "Engineering", "Research", "Business", "Internship", "Fully Funded"]
