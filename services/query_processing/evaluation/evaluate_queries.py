
import json
import sys
from pathlib import Path

# Allow importing modules from query_processing
PROJECT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_DIR))

from query_processor import process_query


# Load evaluation dataset
DATASET_PATH = Path(__file__).parent / "queries.json"

with open(DATASET_PATH, "r", encoding="utf-8") as file:
    queries = json.load(file)


# Fields to evaluate
FIELDS = [
    "language",
    "location",
    "category",
    "event_type"
]

total_checks = 0
correct_checks = 0


print("\n========== QUERY PROCESSING EVALUATION ==========\n")

for item in queries:

    query = item["query"]
    result = process_query(query)

    print(f"Query ID: {item['id']}")
    print(f"Query: {query}")

    for field in FIELDS:

        expected = item[f"expected_{field}"]
        actual = result.get(field)

        total_checks += 1

        if actual == expected:
            correct_checks += 1
            status = "PASS"
        else:
            status = "FAIL"

        print(f"{field}: {status}")
        print(f"  Expected: {expected}")
        print(f"  Actual:   {actual}")

    print("-" * 50)


# Final accuracy
accuracy = (correct_checks / total_checks) * 100

print("\n========== FINAL RESULTS ==========")
print(f"Correct checks: {correct_checks}/{total_checks}")
print(f"Accuracy: {accuracy:.2f}%")
