
# STEM Event Discovery - Query Processing

## Overview
This module processes multilingual STEM event search queries using BGE-M3 embeddings and FastAPI.

## Features
- English, Bangla and Romanized Bangla query support
- Query normalization
- Category extraction
- Location extraction
- Event type extraction
- Date extraction
- Keyword extraction
- 1024-dimensional BGE-M3 query embeddings
- FastAPI integration

## Technologies
- Python 3.11
- BGE-M3
- FlagEmbedding
- FastAPI
- NumPy

## Installation

Create a virtual environment:

```bash
py -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run the API

```bash
uvicorn main:app --reload
```

## API Documentation

Open:

http://127.0.0.1:8000/docs

## Endpoints

- GET `/` - API status
- GET `/health` - Health check
- POST `/process-query` - Query processing and embedding generation
- POST `/search` - Local hybrid search prototype
