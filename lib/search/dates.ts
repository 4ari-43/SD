export function formatListingDate(timestamp: string, includeYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", month: includeYear ? "long" : "short", day: "numeric",
    ...(includeYear && { year: "numeric" }),
  }).format(new Date(timestamp))
}
