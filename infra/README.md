# Run opportunity search locally

Use Node.js 22.18+ with pnpm and a Docker Compose installation. OpenSearch needs adequate memory and a Linux host or VM with `vm.max_map_count` of at least 262144. The Compose services bind to loopback and use an unsecured OpenSearch instance for local development.

```sh
pnpm install
docker compose -f infra/compose.yaml --profile ingest up -d --build
pnpm search:index create opportunities-v1
pnpm search:index import tests/search/fixtures/listings.jsonl opportunities-v1
pnpm search:index promote opportunities-v1
pnpm dev
```

Open [Pathfinder](http://localhost:3000). Try `C++`, or browse the Internships category. The committed fixtures are synthetic. BM25 works as soon as the index is populated. First-time model downloads can take a few minutes. Check `http://localhost:8001/health` and `http://localhost:8002/health`, then run:

```sh
pnpm search:index backfill
```

Copy the root `.env.example` to `.env.local` when changing application service URLs or ranking mode. The default is `hybrid`. Set `SEARCH_RANKING_MODE=bm25` for lexical-only serving or `rerank` after evaluation. To run only the lexical baseline, start the `opensearch`, `redis`, and `cache` Compose services. Redis is accessed through a private cache adapter, and ingest-time inference runs separately from request-time inference. Stop the ingest service when backfills are finished.

## Integrate the listing feed

- Each JSONL row is a complete listing or a delete event. See [the fixture](../tests/search/fixtures/listings.jsonl) for the listing format. Use globally unique IDs with letters, numbers, underscores, hyphens, or dots. The API reserves `search`, `facets`, and `suggestions`. Keep the same ID and source across updates. Supply an increasing positive integer `sourceVersion` from the feed.
- A delete event requires `id`, `source`, `sourceVersion`, `updatedAt`, and `status: "deleted"`. Retain tombstones in source exports so outdated events cannot restore deleted listings after a rebuild.
- Provide timestamps with an offset or `Z`. Omit unknown dates and compensation. Normalize any deadline given as a calendar day into the actual cutoff in the source timezone before import. The current “Today” filter uses UTC. Salary thresholds use the minimum of the stated USD range and its stated period.
- Supply the same `canonicalKey` across sources when you know they refer to the same listing. The adapter otherwise uses the canonical URL when present, then source and ID. Index writes are version-aware and safe to retry. Schedule the `backfill` command with one worker per target. It can be rerun after an inference failure and skips listings with the current embedding version.
- Rebuild into a new physical index, import the source export including tombstones, and backfill before promoting. Replay feed changes and pause writes for the alias swap so the new index has all updates. Keep the old index and source export, and configure OpenSearch snapshots in production. Roll back by promoting the old index after replaying writes made since the swap.

## Verify relevance and capacity

```sh
pnpm test:index
pnpm test:search
pnpm typecheck
pnpm build
pnpm search:evaluate tests/search/fixtures/judgments.jsonl
```

Set `SEARCH_INTEGRATION=1` when running `pnpm test:search` against the disposable local OpenSearch stack. The integration test creates and cleans up its own index.

For real evaluation, use at least 200 human-judged English queries with tuning and held-out splits. Each judgment row supplies `query`, optional `filters`, `split`, `category`, and a `relevance` map from listing ID to grade 0–3. Pool candidates from every ranker before judging. Include exact technical searches, paraphrases, selective filters, and no-match queries. Compare Recall@200, NDCG@10, and MRR@10 by category and split. Treat degraded runs as invalid for model promotion. Enable reranking after a held-out relevance lift without a material category regression. Compare the default ONNX graph with a CPU-compatible INT8 graph using separate runs. Use the same held-out queries and require an NDCG@10 loss of at most 0.01. Set the Compose `RERANK_ONNX_FILE` to the selected file and set `RERANK_VARIANT` consistently in the app.

For the capacity run, use a dedicated Compose stack or staging cluster. Generate a 100,000-document synthetic corpus, create a fresh physical index, import and backfill it, then promote that index in the capacity environment:

```sh
pnpm search:load-data data/local
pnpm search:index create opportunities-load-v1
pnpm search:index import data/local/load-listings.jsonl opportunities-load-v1
pnpm search:index backfill opportunities-load-v1
pnpm search:index promote opportunities-load-v1
pnpm search:load http://localhost:3000 data/local/load-queries.jsonl 20 120
```

Use the production build for timing. Test with normal caching and with `SEARCH_EMBED_CACHE=off` for a cache-miss run. Report corpus size, CPU and RAM per service, p50/p95/p99, rate, errors, and degradation. Acceptance is p95 below 750 ms, errors and degradation below 1%, and sustained 20 QPS on the stated hardware. Inspect the structured Next.js logs for stage times and ranking version. Measure OpenSearch PIT use and set the context limit for the peak number of concurrent chronological sessions. Increase inference replicas before widening the rerank pool. Keep private services behind the app and use authenticated TLS for production storage and transport.
