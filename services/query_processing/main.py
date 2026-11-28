
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from query_processor import create_search_request
from hybrid_search import hybrid_search

from config import (
    API_TITLE,
    API_DESCRIPTION,
    API_VERSION,
    MODEL_NAME,
    EMBEDDING_DIMENSIONS,
    MAX_QUERY_LENGTH
)


# ==========================================
# 1. FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION
)


# ==========================================
# 2. REQUEST MODEL
# ==========================================

class SearchRequest(BaseModel):

    query: str = Field(
        min_length=1,
        max_length=MAX_QUERY_LENGTH,
        description="User's STEM event search query"
    )


# ==========================================
# 3. HOME ENDPOINT
# ==========================================

@app.get("/")
def home():

    return {
        "message": "STEM Event Discovery API is running!",
        "version": API_VERSION
    }


# ==========================================
# 4. HEALTH CHECK
# ==========================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "service": "Query Processing",
        "embedding_model": MODEL_NAME,
        "embedding_dimensions": EMBEDDING_DIMENSIONS
    }


# ==========================================
# 5. QUERY PROCESSING ENDPOINT
# ==========================================

@app.post("/process-query")
def process_query(request: SearchRequest):

    query = request.query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty."
        )

    try:

        result = create_search_request(query)

        return result

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Query processing failed: {str(error)}"
        )


# ==========================================
# 6. HYBRID SEARCH ENDPOINT
# ==========================================

@app.post("/search")
def search(request: SearchRequest):

    query = request.query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty."
        )

    try:

        processed, results = hybrid_search(query)

        return {
            "processed_query": processed,
            "total_results": len(results),
            "results": results
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(error)}"
        )
