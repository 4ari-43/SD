import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { backfillEmbeddings, mapping, parseListing, promote, upsertListings, versionedIndex, type IndexWrite } from "../../lib/server/search/ingest.ts"
import { deadline, indexName, openSearch } from "../../lib/server/search/transport.ts"

const [command, arg, extra] = process.argv.slice(2)

async function importFile(path: string, target: string) {
  // Validate the whole file before applying writes. Stream twice to bound memory.
  for (const write of [false, true]) {
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
    let batch: IndexWrite[] = []
    let number = 0
    let updated = 0
    for await (const line of lines) {
      number++
      if (!line.trim()) continue
      let item: IndexWrite
      try {
        item = parseListing(JSON.parse(line))
      } catch (error) {
        throw new Error(`Line ${number}: ${error instanceof Error ? error.message : error}`)
      }
      if (!write) continue
      batch.push(item)
      if (batch.length === 200) {
        updated += await upsertListings(batch, target)
        batch = []
      }
    }
    if (write) {
      updated += await upsertListings(batch, target)
      await openSearch(`/${target}/_refresh`, "POST", undefined, deadline(30000))
      console.info(`${updated} documents updated in ${target}`)
    }
  }
}

async function main() {
  if (command === "create" && arg) {
    await openSearch("/" + versionedIndex(arg), "PUT", mapping, deadline(30000))
    console.info(`Created ${arg}`)
  } else if (command === "promote" && arg) {
    await promote(versionedIndex(arg))
    console.info(`Alias ${indexName()} now points to ${arg}`)
  } else if (command === "import" && arg) {
    await importFile(arg, extra ? versionedIndex(extra) : indexName())
  } else if (command === "backfill") {
    const target = arg ? versionedIndex(arg) : indexName()
    console.info(`${await backfillEmbeddings(target)} embeddings updated`)
  } else {
    throw new Error("Usage: create INDEX | promote INDEX | import FILE [INDEX] | backfill [INDEX]")
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
