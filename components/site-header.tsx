"use client"

import { Bell, BriefcaseBusiness, ChevronDown, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigationItems = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/resources", label: "Resources", dropdown: true },
  { href: "/about", label: "About" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="navbar">
      <Link href="/" className="brand">
        <span className="brand-mark"><BriefcaseBusiness size={20} /></span>
        <span>JobHunt</span>
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "nav-current" : undefined}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
            {"dropdown" in item && item.dropdown && <ChevronDown size={14} />}
          </Link>
        ))}
      </nav>
      <div className="header-actions" aria-label="Account actions">
        <button type="button" className="header-icon" aria-label="Notifications"><Bell size={20} /></button>
        <button type="button" className="header-profile" aria-label="Open account menu">
          <span className="profile-avatar"><UserRound size={18} /></span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  )
}
