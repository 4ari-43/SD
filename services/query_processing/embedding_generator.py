
from model import model
from config import EMBEDDING_DIMENSIONS, MAX_EMBEDDING_LENGTH


# ==========================================
# QUERY EMBEDDING GENERATION
# ==========================================

def generate_query_embedding(query):

    embedding = model.encode(
        [query],
        max_length=MAX_EMBEDDING_LENGTH
    )["dense_vecs"]

    result = embedding[0].tolist()

    # Check embedding dimensions
    if len(result) != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"Expected {EMBEDDING_DIMENSIONS} dimensions, "
            f"but received {len(result)}."
        )

    return result
