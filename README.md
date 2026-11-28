# Pathfinder

Pathfinder is a web app for finding jobs, internships, and scholarships. Search by role, organization, or skill, then narrow results by location, work mode, field, posting date, or compensation. Each listing has a detail page.

## Run locally

You’ll need Node.js 22.18 or later, pnpm, and Docker Compose. Run these commands from the project root.

```sh
pnpm install
docker compose -f infra/compose.yaml --profile ingest up -d --build
```

Once [OpenSearch](http://127.0.0.1:9200/) responds, create the index and seed it with the bundled sample listings.

```sh
pnpm search:index create opportunities-v1
pnpm search:index import tests/search/fixtures/listings.jsonl opportunities-v1
pnpm search:index promote opportunities-v1
```

Start the Next.js development server with npm:

```sh
npm run dev
```

You can also use `pnpm dev`. The search backend runs separately through the setup above.

Open [Pathfinder](http://localhost:3000) and try searching for `C++` or browsing Internships. The bundled listings are synthetic. Keyword search works as soon as they’re indexed. To add semantic matches, wait for the [online inference service](http://127.0.0.1:8001/health) and [ingestion inference service](http://127.0.0.1:8002/health) to finish loading their models, then run `pnpm search:index backfill`.

Copy [`.env.example`](.env.example) to `.env.local` if you need to override service URLs or ranking settings. The [search runbook](infra/README.md) covers importing your own listings, changing ranking modes, and rolling back an index.

## How search works

Next.js serves the interface and search API. By default, relevance search combines OpenSearch BM25 keyword matches with vector matches from a BGE-small embedding model. Both paths apply the selected filters. Reciprocal rank fusion merges their results, and an optional MiniLM model can rerank the top 30 on CPU. Newest and Deadline sorts use keyword matching and structured dates. Redis caches query embeddings and stores short-lived pagination state.

See the [retrieval and ranking architecture](multi_stage_retrieval_ranking_architecture.md) for the pipeline and evaluation targets.

## Project layout

| Directory | What it contains |
| --- | --- |
| `app/`, `components/` | Next.js pages, API routes, and React components |
| `lib/search/` | Shared search types and display helpers |
| `lib/server/search/` | Retrieval, ranking, pagination, and indexing logic |
| `services/` | Python CPU inference and the Redis cache adapter |
| `infra/` | Docker Compose configuration and the search runbook |
| `scripts/search/`, `tests/search/` | Indexing and benchmark commands, tests, and sample data |

## Development checks

```sh
pnpm typecheck
pnpm test:index
pnpm test:search
pnpm build
```

Set `SEARCH_INTEGRATION=1` when running `pnpm test:search` to include the live OpenSearch test. The [runbook](infra/README.md#verify-relevance-and-capacity) also shows how to measure ranking quality and generate a load-test corpus.
