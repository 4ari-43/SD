
# Query Processing API Contract

## 1. Overview

The Query Processing module accepts a user's STEM event search query and converts it into structured information.

It supports:
- English
- Bangla
- Mixed Bangla-English
- Romanized Bangla

It also generates a 1024-dimensional query embedding using BAAI/bge-m3.

## 2. API Base URL

Local development:

http://127.0.0.1:8000

## 3. Process Query Endpoint

**Endpoint:** `POST /process-query`

**Purpose:** Processes a user's query and returns structured query information and its embedding.

### Request Body

```json
{
  "query": "Find robotics workshops in Dhaka"
}
```

### Response

```json
{
  "original_query": "Find robotics workshops in Dhaka",
  "normalized_query": "find robotics workshops in dhaka",
  "language": "english",
  "location": "Dhaka",
  "category": "Robotics",
  "event_type": "Workshop",
  "date": {
    "date_expression": null,
    "date_from": null,
    "date_to": null
  },
  "keywords": ["robotics"],
  "embedding_model": "BAAI/bge-m3",
  "embedding_dimensions": 1024,
  "query_embedding": ["1024 numerical values"]
}
```

Note: The query_embedding field contains 1024 actual numerical values. They are shortened in this example.

## 4. Search Endpoint

**Endpoint:** `POST /search`

**Purpose:** Processes a query and searches the current local sample event dataset using hybrid search.

### Request Body

```json
{
  "query": "Find robotics workshops in Dhaka"
}
```

### Response Structure

```json
{
  "processed_query": {},
  "total_results": 1,
  "results": []
}
```

Note: This endpoint currently uses the local sample dataset. Integration with the team's final retrieval and ranking system is pending.

## 5. Health Check

**Endpoint:** `GET /health`

Returns the service status, embedding model, and embedding dimensions.

## 6. Important Information for Integration

- Query embeddings are generated using BAAI/bge-m3.
- Embedding dimensions: 1024.
- Event embeddings should be generated during indexing, not every time a user searches.
- The query embedding can be passed to the retrieval system for semantic search.
- Structured filters such as location, category, event type, and date can be used alongside the embedding.
- The final integration format should be agreed upon with the retrieval and indexing team.

## 7. Current Module Responsibility

The Query Processing module is responsible for:

1. Query normalization.
2. Language detection.
3. Location extraction.
4. Category extraction.
5. Event type extraction.
6. Date extraction.
7. Keyword extraction.
8. Query embedding generation.
9. Returning structured search information through the API.
