import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import test from "node:test"
import type { IndexedOpportunity } from "../../lib/search/contracts.ts"
import { mapping, parseListing, upsertListings } from "../../lib/server/search/ingest.ts"
import { embeddingVersion } from "../../lib/server/search/model.ts"
import { chronological, lexical, openPit, vector } from "../../lib/server/search/opensearch.ts"
import { eligibility } from "../../lib/server/search/query.ts"
import { detail } from "../../lib/server/search/service.ts"
import { deadline, openSearch } from "../../lib/server/search/transport.ts"

test("real OpenSearch mapping, lexical analyzer, filtered ANN, PIT pagination, and tombstone ordering", {
  skip: process.env.SEARCH_INTEGRATION !== "1",
}, async () => {
  // Set only in this test process. Use a disposable index on a local test cluster.
  const target = "opportunities-test-" + randomUUID()
  const alias = target + "-alias"
  process.env.OPENSEARCH_INDEX = target
  await openSearch("/" + target, "PUT", { ...mapping, aliases: { [alias]: { is_write_index: true } } }, deadline(10000))
  process.env.OPENSEARCH_INDEX = alias
  try {
    const [cpp, intern, grant, dotnet] = readFileSync(new URL("./fixtures/listings.jsonl", import.meta.url), "utf8").trim()
      .split("\n").map(line => parseListing(JSON.parse(line))) as IndexedOpportunity[]
    const embedding = [1, ...Array<number>(383).fill(0)]
    const version = embeddingVersion()
    await upsertListings([cpp, intern, grant, dotnet].map(item => ({
      ...item, embedding, embeddingVersion: item === dotnet ? "older" : version,
    })), target)
    await openSearch("/" + target + "/_refresh", "POST", undefined, deadline(5000))
    const now = new Date()
    assert.deepEqual((await lexical("c++", eligibility({}, now), deadline(2000))).map(row => row.listing.id), [cpp.id])
    assert.deepEqual((await vector(embedding, version, eligibility({ type: "Job" }, now), deadline(2000))).map(row => row.listing.id), [cpp.id])
    const pit = await openPit(deadline(2000))
    try {
      const page1 = await chronological("", {}, now, "Newest", 1, deadline(2000), pit)
      assert.equal(page1.hits.hits[0]._source.id, grant.id)
      const page2 = await chronological("", {}, now, "Newest", 1, deadline(2000), pit, page1.hits.hits[0].sort)
      assert.equal(page2.hits.hits[0]._source.id, dotnet.id)
    } finally {
      await openSearch("/_search/point_in_time", "DELETE", { pit_id: [pit] }, deadline(2000))
    }
    assert.equal(await upsertListings([{ id: cpp.id, status: "deleted", source: cpp.source, sourceVersion: 2, updatedAt: cpp.updatedAt }], target), 1)
    assert.equal(await upsertListings([cpp], target), 0)
    assert.equal(await detail(cpp.id, deadline(2000)), null)
  } finally {
    await openSearch("/" + target, "DELETE", undefined, deadline(10000))
  }
})
