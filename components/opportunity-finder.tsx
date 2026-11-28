"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUp, Check, ChevronDown, Clock3, MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import type { Opportunity } from "@/lib/opportunities"
import { popularSearches } from "@/lib/opportunities"
import type { Filters } from "@/lib/search-opportunities"
import { compensationFilters, modes, periods, types, type SearchHit, type SearchRequest } from "@/lib/search/contracts"
import { formatListingDate } from "@/lib/search/dates"
import { useOpportunitySearch, useOpportunitySuggestions } from "./use-opportunity-search"

const initialFilters: Filters = {
  type: "All",
  location: "",
  mode: "Any",
  category: "All fields",
  sort: "Relevance",
  timePeriod: "Any time",
  compensation: "Any",
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (!query || index < 0) return <>{text}</>
  return <>{text.slice(0, index)}<mark className="suggestion-mark">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>
}

function activeFilterCount(filters: Filters) {
  return [
    filters.type !== "All",
    filters.location !== "",
    filters.mode !== "Any",
    filters.category !== "All fields",
    filters.sort !== "Relevance",
    filters.timePeriod !== "Any time",
    filters.compensation !== "Any",
  ].filter(Boolean).length
}

function FilterControls({
  filters,
  setFilters,
  idPrefix,
  categories,
}: {
  filters: Filters
  setFilters: (filters: Filters) => void
  idPrefix: string
  categories: string[]
}) {
  const update = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value })

  return <div className="filter-controls">
    <span className="filter-label">Opportunity type</span>
    <div className="type-options">{["All", "Job", "Internship", "Scholarship"].map((type) => <button key={type} type="button" aria-pressed={filters.type === type} className={`type-option ${filters.type === type ? "selected" : ""}`} onClick={() => update("type", type)}>{type === "All" ? "All opportunities" : `${type}s`}{filters.type === type && <Check size={14} />}</button>)}</div>

    <label className="filter-label" htmlFor={`${idPrefix}-time-period`}>Posted within</label>
    <div className="select-wrap"><select id={`${idPrefix}-time-period`} value={filters.timePeriod} onChange={(event) => update("timePeriod", event.target.value)}><option>Any time</option><option>Today</option><option>Past 7 days</option><option>Past 30 days</option></select><ChevronDown size={15} /></div>

    <label className="filter-label" htmlFor={`${idPrefix}-compensation`}>Salary / funding</label>
    <div className="select-wrap"><select id={`${idPrefix}-compensation`} value={filters.compensation} onChange={(event) => update("compensation", event.target.value)}><option value="Any">Any compensation</option><option value="hourly-40">$40+ per hour</option><option value="annual-80">$80k+ per year</option><option value="funding">Scholarship / stipend</option></select><ChevronDown size={15} /></div>

    <label className="filter-label" htmlFor={`${idPrefix}-location`}>Location</label>
    <div className="filter-input-wrap"><MapPin size={15} /><input id={`${idPrefix}-location`} maxLength={100} value={filters.location} onChange={(event) => update("location", event.target.value)} placeholder="City, country, or remote" /></div>

    <label className="filter-label" htmlFor={`${idPrefix}-mode`}>Work mode</label>
    <div className="select-wrap"><select id={`${idPrefix}-mode`} value={filters.mode} onChange={(event) => update("mode", event.target.value)}><option>Any</option><option>Remote</option><option>On-site</option><option>Hybrid</option></select><ChevronDown size={15} /></div>

    <label className="filter-label" htmlFor={`${idPrefix}-category`}>Field of interest</label>
    <div className="select-wrap"><select id={`${idPrefix}-category`} value={filters.category} onChange={(event) => update("category", event.target.value)}>{["All fields", ...categories].map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={15} /></div>

    <div className="filter-divider" />
    <label className="filter-label" htmlFor={`${idPrefix}-sort`}>Sort by</label>
    <div className="select-wrap"><select id={`${idPrefix}-sort`} value={filters.sort} onChange={(event) => update("sort", event.target.value)}><option>Relevance</option><option>Newest</option><option>Deadline</option></select><ChevronDown size={15} /></div>
  </div>
}

function SearchBox({
  onSearch,
  filters,
  setFilters,
  onClearFilters,
  categories,
}: {
  onSearch: (value: string) => void
  filters: Filters
  setFilters: (filters: Filters) => void
  onClearFilters: () => void
  categories: string[]
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const suggestions = useOpportunitySuggestions(query, open)
  useEffect(() => {
    function outside(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false)
        setFiltersOpen(false)
      }
    }
    document.addEventListener("mousedown", outside)
    return () => document.removeEventListener("mousedown", outside)
  }, [])
  function submit(value = query) {
    setQuery(value)
    onSearch(value)
    setOpen(false)
    setFiltersOpen(false)
    setActive(-1)
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && open && suggestions.length) { event.preventDefault(); setActive((current) => (current + 1) % suggestions.length) }
    else if (event.key === "ArrowUp" && open && suggestions.length) { event.preventDefault(); setActive((current) => (current - 1 + suggestions.length) % suggestions.length) }
    else if (event.key === "Enter") { if (event.nativeEvent.isComposing || event.keyCode === 229) return; event.preventDefault(); submit(open ? suggestions[active] ?? query : query) }
    else if (event.key === "Escape") setOpen(false)
  }
  return <div className="search-wrap" ref={root} onKeyDown={(event) => {
    if (event.key === "Escape") {
      setOpen(false)
      setFiltersOpen(false)
    }
  }}>
    <div className="search-control-row">
      <div className={`search-box ${open ? "search-box-open" : ""}`}>
        <Search className="search-icon" size={21} aria-hidden="true" />
        <input aria-label="Search opportunities" aria-autocomplete="list" aria-controls={open && suggestions.length ? "search-suggestions" : undefined} aria-expanded={open && suggestions.length > 0} aria-activedescendant={open && suggestions[active] ? `suggestion-${active}` : undefined} maxLength={256} role="combobox" placeholder="Search roles, companies, or skills..." value={query} onFocus={() => { setFiltersOpen(false); if (query) setOpen(true) }} onChange={(event) => { setQuery(event.target.value); setOpen(true); setFiltersOpen(false); setActive(-1) }} onKeyDown={handleKeyDown} />
        {query && <button className="clear-search" aria-label="Clear search" onClick={() => { setQuery(""); onSearch(""); setOpen(true); setFiltersOpen(false); setActive(-1) }}><X size={17} /></button>}
        <kbd className="enter-hint">↵ <span>Enter</span></kbd>
        <button className="search-submit" onClick={() => submit()} aria-label="Search opportunities"><Search size={19} /><span>Search</span></button>
      </div>
      <button
        type="button"
        className={`search-filter-trigger ${filtersOpen ? "filter-trigger-open" : ""}`}
        aria-label={`Filters${activeFilterCount(filters) ? `, ${activeFilterCount(filters)} active` : ""}`}
        aria-expanded={filtersOpen}
        aria-controls="search-filter-popover"
        onClick={() => {
          setFiltersOpen((current) => !current)
          setOpen(false)
        }}
      >
        <SlidersHorizontal size={18} />
        <span>Filters</span>
        {activeFilterCount(filters) > 0 && <span className="filter-count">{activeFilterCount(filters)}</span>}
      </button>
    </div>
    {filtersOpen && <aside id="search-filter-popover" className="filter-sidebar search-filter-popover" role="dialog" aria-label="Filter opportunities">
      <div className="filter-heading"><div><SlidersHorizontal size={17} /><strong>Filter opportunities</strong></div><button type="button" onClick={onClearFilters}>Clear all</button></div>
      <FilterControls filters={filters} setFilters={setFilters} idPrefix="popover" categories={categories} />
      <div className="filter-tip"><Sparkles size={15} /><span>Filters work together with your search.</span></div>
    </aside>}
    {open && suggestions.length > 0 && <div id="search-suggestions" className="suggestions" role="listbox" aria-label="Search suggestions">
      {suggestions.map((suggestion, index) => <button id={`suggestion-${index}`} role="option" tabIndex={-1} aria-selected={active === index} key={suggestion} className={`suggestion ${active === index ? "suggestion-active" : ""}`} onMouseEnter={() => setActive(index)} onClick={() => submit(suggestion)}><Search size={16} /><span><Highlight text={suggestion} query={query} /></span><ArrowUp size={14} className="suggestion-enter" /></button>)}
    </div>}
  </div>
}

function OpportunityCard({ item, featured = false }: { item: SearchHit; featured?: boolean }) {
  const colors = item.type === "Job" ? "badge-job" : item.type === "Internship" ? "badge-internship" : "badge-scholarship"
  const initial = item.organization.charAt(0)
  return <article className={`opportunity-card ${featured ? "featured-card" : ""}`}>
    <div className="card-top"><div className={`org-avatar org-${initial.toLowerCase()}`}>{initial}</div><span className={`type-badge ${colors}`}>{item.type}</span><button className="save-button" aria-label={`Save ${item.title}`} title="Save opportunity"><span>☆</span></button></div>
    <div className="card-heading"><h3>{item.title}</h3><p>{item.organization}</p></div>
    <p className="card-description">{item.description}</p>
    <div className="card-meta"><span><MapPin size={14} />{item.location}</span><span><span className={`mode-dot ${item.mode.toLowerCase()}`} />{item.mode}</span></div>
    <div className="tag-row">{item.skills.slice(0, 3).map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}</div>
    <div className="card-bottom"><span className="compensation">{item.compensation}</span><Link href={`/opportunities/${item.id}`} className="details-link">View details <ArrowRight size={15} /></Link></div>
    {item.deadlineAt && <div className="deadline-note"><Clock3 size={13} /> Apply by {formatListingDate(item.deadlineAt)}</div>}
  </article>
}

function FilterSidebar({ filters, setFilters, clear, categories }: { filters: Filters; setFilters: (filters: Filters) => void; clear: () => void; categories: string[] }) {
  return <aside className="filter-sidebar">
    <div className="filter-heading"><div><SlidersHorizontal size={17} /><strong>Filters</strong></div><button onClick={clear}>Clear all</button></div>
    <FilterControls filters={filters} setFilters={setFilters} idPrefix="sidebar" categories={categories} />
  </aside>
}

export function OpportunityFinder({ initialType }: { initialType?: Opportunity["type"] } = {}) {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>(() => ({ ...initialFilters, ...(initialType ? { type: initialType } : {}) }))
  const [submitted, setSubmitted] = useState(true)
  const [mobileFilters, setMobileFilters] = useState(false)
  const [searchSequence, setSearchSequence] = useState(0)
  const hasSubmitted = useRef(false)
  const [categories, setCategories] = useState<string[]>([])
  const sort = filters.sort as SearchRequest["sort"]
  const results = useOpportunitySearch({
    query, sort, pageSize: 20, filters: {
      type: types.find(type => type === filters.type),
      mode: modes.find(mode => mode === filters.mode),
      timePeriod: periods.find(period => period === filters.timePeriod),
      compensation: compensationFilters.find(value => value === filters.compensation),
      category: filters.category === "All fields" ? undefined : filters.category,
      location: filters.location || undefined,
    },
  }, submitted, searchSequence)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/opportunities/facets", { signal: controller.signal }).then(async response => {
      if (response.ok) {
        const data = await response.json()
        if (!controller.signal.aborted) setCategories(data.categories)
      }
    }).catch(() => undefined)
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-reveal]")
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" })

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [submitted])
  useEffect(() => {
    if (submitted) {
      document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" })
      hasSubmitted.current = true
    } else if (hasSubmitted.current) {
      document.getElementById("home")?.scrollIntoView({ behavior: "smooth", block: "start" })
      hasSubmitted.current = false
    }
  }, [submitted, query, searchSequence])
  const clearFilters = () => setFilters({ ...initialFilters, ...(initialType ? { type: initialType } : {}) })
  const updateFilterFromChip = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value })
  const clear = () => { clearFilters(); setQuery(""); setSubmitted(true) }
  const runSearch = (value: string) => { setQuery(value); setSubmitted(true); setSearchSequence((current) => current + 1) }
  return <main>
    <SiteHeader />
    <section id="home" className="hero">
      <div className="hero-glow" aria-hidden="true" /><div className="hero-inner">
        <h1>Find Your <span className="headline-accent">Dream Job</span></h1>
        <p className="hero-copy">Discover thousands of job opportunities from top companies.</p>
        <div className="hero-search"><SearchBox onSearch={runSearch} filters={filters} setFilters={setFilters} onClearFilters={clearFilters} categories={categories} /><div className="popular-row" aria-label="Popular searches">{popularSearches.slice(0, 4).map((term) => <button key={term} onClick={() => runSearch(term)}>{term}</button>)}</div></div>
      </div>
    </section>
    {submitted && <section id="explore" className="explore-section scroll-reveal" data-reveal>
      <div className="explore-head">
        <div>
          <h2>{initialType === "Job" ? "Jobs" : initialType === "Internship" ? "Internships" : initialType === "Scholarship" ? "Scholarships" : "Search results"}</h2>
          <p>{query ? `Matches for “${query}”` : "Browse available opportunities."}</p>
        </div>
      </div>
      <div className="job-filter-chips" aria-label="Quick filters">
        <button className="all-filter-chip" type="button" onClick={() => setFilters({ ...initialFilters })}><SlidersHorizontal size={15} /> All Filters</button>
        <button type="button" onClick={() => updateFilterFromChip("type", "All")}>Job Type <ChevronDown size={14} /></button>
        <button type="button">Experience Level <ChevronDown size={14} /></button>
        <button type="button" onClick={() => updateFilterFromChip("compensation", filters.compensation === "annual-80" ? "Any" : "annual-80")}>Salary Range <ChevronDown size={14} /></button>
        <button type="button" onClick={() => updateFilterFromChip("mode", filters.mode === "Remote" ? "Any" : "Remote")}>Remote <ChevronDown size={14} /></button>
        <button type="button" onClick={() => setMobileFilters(!mobileFilters)}>More Filters <ChevronDown size={14} /></button>
        <label className="sort-chip">Sort by:
          <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option>Relevance</option><option>Newest</option><option>Deadline</option>
          </select>
        </label>
      </div>
      <div className="results-layout">
        <div className={`filters-mobile ${mobileFilters ? "filters-mobile-open" : ""}`}><FilterSidebar filters={filters} setFilters={setFilters} clear={clear} categories={categories} /></div>
        <div className="results-column" aria-busy={results.loading || results.loadingMore}>
          {results.loading && <div className="empty-results" role="status"><h3>Searching opportunities…</h3></div>}
          {results.error === "first" && <div className="empty-results" role="alert"><h3>Search is temporarily unavailable</h3><button onClick={results.restart}>Try again</button></div>}
          {results.data && <>
            <div className="results-toolbar" role="status">
              <span><strong>{results.data.results.length}</strong> shown{results.data.count.relation === "exact" ? ` · ${results.data.count.value.toLocaleString()} listings matched` : results.data.count.relation === "atLeast" ? ` · ${results.data.count.value.toLocaleString()}+ listings matched` : ""}</span>
              <span className="results-sort-note">Sorted by {filters.sort.toLowerCase()}</span>
            </div>
            {results.data.results.length > 0
              ? <div className="results-grid">{results.data.results.map(item => <OpportunityCard item={item} key={item.id} />)}</div>
              : !results.data.nextCursor && <div className="empty-results"><span className="empty-icon"><Search size={22} /></span><h3>No opportunities found</h3><p>Try a different search or loosen your filters.</p><button onClick={clear}>Clear search &amp; filters</button></div>}
            {results.error === "expired" && <div className="results-toolbar" role="alert"><span>These results have expired.</span><button className="search-pagination" onClick={results.restart}>Refresh results</button></div>}
            {results.error !== "expired" && results.data.nextCursor && <div className="results-toolbar">
              {results.error === "more" && <span role="alert">More results could not be loaded.</span>}
              <button className="search-pagination" disabled={results.loadingMore} onClick={results.loadMore}>{results.loadingMore ? "Loading…" : results.error === "more" ? "Try again" : "Load more"}</button>
            </div>}
            {results.data.degraded.includes("pagination") && <div className="results-toolbar" role="status">More results are temporarily unavailable.</div>}
          </>}
        </div>
      </div>
    </section>}
  </main>
}
