
import json
import numpy as np
from pathlib import Path

from model import model
from query_processor import process_query

DATA_FOLDER = Path(__file__).parent / "data"

EVENTS_FILE = DATA_FOLDER / "events.json"
EMBEDDINGS_FILE = DATA_FOLDER / "event_embeddings.npy"


def load_data():
    with open(EVENTS_FILE, "r", encoding="utf-8") as file:
        events = json.load(file)

    embeddings = np.load(EMBEDDINGS_FILE)

    if len(events) != len(embeddings):
        raise ValueError("Event count and embedding count do not match!")

    return events, embeddings


def hybrid_search(query, top_k=5):
    processed = process_query(query)
    events, event_embeddings = load_data()

    # Generate embedding for the user's query
    query_embedding = model.encode(
        [query],
        max_length=256
    )["dense_vecs"][0]

    # Calculate cosine similarity
    similarities = np.dot(
        event_embeddings,
        query_embedding
    ) / (
        np.linalg.norm(event_embeddings, axis=1)
        * np.linalg.norm(query_embedding)
    )

    results = []

    for index, event in enumerate(events):

        # Category filter
        if processed["category"]:
            if event["category"] != processed["category"]:
                continue

        # Location filter
        if processed["location"]:
            if event["location"].lower() != processed["location"].lower():
                continue

        # Event type filter
        event_type = processed["event_type"]

        if event_type and event_type != "Event":
            if event["event_type"].lower() != event_type.lower():
                continue

        # Date filter
        date_from = processed["date"]["date_from"]
        date_to = processed["date"]["date_to"]

        if date_from and date_to:
            if not (date_from <= event["date"] <= date_to):
                continue

        # Keyword filter
        keywords = processed["keywords"]

        if keywords:
            searchable_text = (
                event["title"] + " " +
                event["description"] + " " +
                event["category"]
            ).lower()

            if not any(
                keyword.lower() in searchable_text
                for keyword in keywords
            ):
                continue

        results.append({
            "event": event,
            "similarity": float(similarities[index])
        })

    # Rank matching events by semantic similarity
    results.sort(
        key=lambda item: item["similarity"],
        reverse=True
    )

    return processed, results[:top_k]


if __name__ == "__main__":
    query = input("\nEnter your search query: ")

    processed, results = hybrid_search(query)

    print("\nPROCESSED QUERY")
    print(json.dumps(processed, indent=4, ensure_ascii=False))

    print("\n" + "=" * 50)
    print("HYBRID SEARCH RESULTS")
    print("=" * 50)

    if results:
        print("Matching events:", len(results))

        for rank, result in enumerate(results, start=1):
            event = result["event"]

            print(f"\nRank: {rank}")
            print("Event:", event["title"])
            print("Category:", event["category"])
            print("Type:", event["event_type"])
            print("Location:", event["location"])
            print("Date:", event["date"])
            print("Similarity:", round(result["similarity"], 4))
    else:
        print("No matching events found.")
