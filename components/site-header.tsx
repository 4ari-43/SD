"use client"

import { Command } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigationItems = [
  { href: "/jobs", label: "Jobs" },
  { href: "/internships", label: "Internships" },
  { href: "/scholarships", label: "Scholarships" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="navbar">
      <Link href="/" className="brand">
        <span className="brand-mark"><Command size={19} /></span>
        <span>path<span className="brand-accent">finder</span></span>
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
          </Link>
        ))}
      </nav>
    </header>
  )
}
