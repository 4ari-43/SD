
import json
from pathlib import Path

from query_processor import process_query


# ==========================================
# 1. LOAD EVENT DATASET
# ==========================================

DATA_FILE = Path(__file__).parent / "data" / "events.json"


def load_events():

    with open(DATA_FILE, "r", encoding="utf-8") as file:
        events = json.load(file)

    return events


# ==========================================
# 2. SEARCH EVENTS
# ==========================================

def search_events(query):

    processed = process_query(query)

    events = load_events()

    results = []

    for event in events:

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

            if not any(keyword.lower() in searchable_text for keyword in keywords):
                continue

        results.append(event)

    return processed, results


# ==========================================
# 3. DISPLAY RESULTS
# ==========================================

if __name__ == "__main__":

    query = input("\nEnter your event search: ")

    processed, results = search_events(query)

    print("\nProcessed Query:")
    print(json.dumps(processed, indent=4, ensure_ascii=False))

    print("\n" + "=" * 50)
    print("SEARCH RESULTS")
    print("=" * 50)

    if results:

        print("Total matching events:", len(results))

        for event in results:

            print("\nEvent ID:", event["event_id"])
            print("Title:", event["title"])
            print("Category:", event["category"])
            print("Type:", event["event_type"])
            print("Location:", event["location"])
            print("Date:", event["date"])
            print("Registration:", event["registration_link"])

    else:

        print("No matching events found.")
