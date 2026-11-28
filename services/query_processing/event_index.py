
import json
import numpy as np
from pathlib import Path

from model import model

DATA_FILE = Path(__file__).parent / "data" / "events.json"
OUTPUT_FILE = Path(__file__).parent / "data" / "event_embeddings.npy"


def load_events():
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def generate_event_embeddings():
    events = load_events()

    event_texts = []

    for event in events:
        text = (
            event["title"] + ". " +
            event["description"] + ". " +
            event["category"]
        )
        event_texts.append(text)

    print("Generating embeddings for", len(events), "events...")

    embeddings = model.encode(
        event_texts,
        batch_size=8,
        max_length=256
    )["dense_vecs"]

    np.save(OUTPUT_FILE, embeddings)

    print("Event embeddings generated successfully!")
    print("Number of events:", len(events))
    print("Embedding shape:", embeddings.shape)
    print("Saved to:", OUTPUT_FILE)


if __name__ == "__main__":
    generate_event_embeddings()
