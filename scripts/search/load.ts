import { readFile } from "node:fs/promises"
import { availableParallelism, totalmem } from "node:os"
import { setTimeout } from "node:timers/promises"

async function main() {
  const [baseUrl, fixture, rateArg = "20", durationArg = "120"] = process.argv.slice(2)
  const qps = Number(rateArg)
  const seconds = Number(durationArg)
  if (!baseUrl || !fixture || !Number.isInteger(qps) || !Number.isInteger(seconds) || qps < 1 || seconds < 1) {
    throw new Error("Usage: pnpm search:load BASE_URL JSONL [QPS=20] [SECONDS=120]")
  }
  const inputs = (await readFile(fixture, "utf8")).trim().split(/\r?\n/).filter(Boolean)
    .map(line => {
      const { query, sort, filters } = JSON.parse(line)
      return JSON.stringify({ query, sort, filters, pageSize: 20 })
    })
  if (!inputs.length) throw new Error("No queries found")

  const latencies: number[] = []
  const pending = new Set<Promise<void>>()
  let errors = 0
  let degraded = 0
  let skipped = 0
  const endpoint = new URL("/api/opportunities/search", baseUrl)
  const start = performance.now()
  const total = qps * seconds
  for (let index = 0; index < total; index++) {
    const scheduled = start + index * 1000 / qps
    const delay = scheduled - performance.now()
    if (delay > 0) await setTimeout(delay)
    if (pending.size >= qps * 5) {
      skipped++
      continue
    }
    const launched = performance.now()
    const task = fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: inputs[index % inputs.length], signal: AbortSignal.timeout(5000),
    }).then(async response => {
      const data = await response.json()
      if (!response.ok) errors++
      else if (data.degraded?.length) degraded++
    }).catch(() => { errors++ }).finally(() => {
      latencies.push(performance.now() - launched)
      pending.delete(task)
    })
    pending.add(task)
  }
  await Promise.all(pending)
  latencies.sort((a, b) => a - b)
  const percentile = (fraction: number) => Math.round(latencies[Math.max(0, Math.ceil(fraction * latencies.length) - 1)] ?? 0)
  const report = {
    targetQps: qps, achievedQps: total / ((performance.now() - start) / 1000),
    durationSeconds: seconds, requests: total, errors, degraded, skipped,
    errorRate: (errors + skipped) / total, degradationRate: degraded / total,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
    clientCpuThreads: availableParallelism(), clientRamGiB: Math.round(totalmem() / 1024 ** 3),
  }
  console.log(JSON.stringify(report, null, 2))
  if (report.p95Ms >= 750 || report.errorRate >= 0.01 || report.degradationRate >= 0.01 || report.achievedQps < qps * 0.95) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
