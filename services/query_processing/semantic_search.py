
import json
import numpy as np
from pathlib import Path

from model import model

DATA_FOLDER = Path(__file__).parent / "data"

EVENTS_FILE = DATA_FOLDER / "events.json"
EMBEDDINGS_FILE = DATA_FOLDER / "event_embeddings.npy"


def load_data():
    with open(EVENTS_FILE, "r", encoding="utf-8") as file:
        events = json.load(file)

    embeddings = np.load(EMBEDDINGS_FILE)

    return events, embeddings


def semantic_search(query, top_k=5):
    events, event_embeddings = load_data()

    print("\nGenerating query embedding...")

    query_embedding = model.encode(
        [query],
        max_length=256
    )["dense_vecs"][0]

    similarities = np.dot(
        event_embeddings,
        query_embedding
    ) / (
        np.linalg.norm(event_embeddings, axis=1)
        * np.linalg.norm(query_embedding)
    )

    ranked_indices = np.argsort(similarities)[::-1]

    results = []

    for index in ranked_indices[:top_k]:
        results.append({
            "event": events[index],
            "similarity": float(similarities[index])
        })

    return results


if __name__ == "__main__":
    query = input("\nEnter your search query: ")

    results = semantic_search(query)

    print("\n" + "=" * 50)
    print("SEMANTIC SEARCH RESULTS")
    print("=" * 50)

    for rank, result in enumerate(results, start=1):
        event = result["event"]

        print(f"\nRank: {rank}")
        print("Event:", event["title"])
        print("Category:", event["category"])
        print("Location:", event["location"])
        print("Date:", event["date"])
        print("Similarity:", round(result["similarity"], 4))
