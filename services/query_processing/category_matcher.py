
import re
import numpy as np
from model import model

CATEGORIES = {
    "Artificial Intelligence": (
        "Events about artificial intelligence, machine learning, "
        "deep learning, neural networks and computer vision."
    ),
    "Robotics": (
        "Events about robots, robotics, automation, "
        "robotic systems and robot competitions."
    ),
    "Programming": (
        "Events about programming, coding, algorithms, "
        "software development and competitive programming."
    ),
    "Physics": (
        "Events about physics, mechanics, thermodynamics, "
        "electromagnetism and quantum physics."
    ),
    "Mathematics": (
        "Events about mathematics, algebra, calculus, "
        "statistics and mathematical problem solving."
    ),
    "Biology": (
        "Events about biology, biotechnology, genetics, "
        "microbiology and life sciences."
    )
}

CATEGORY_KEYWORDS = {
    "Artificial Intelligence": [
        "artificial intelligence", "machine learning",
        "deep learning", "neural network", "AI",
        "কৃত্রিম বুদ্ধিমত্তা", "মেশিন লার্নিং",
        "ডিপ লার্নিং"
    ],
    "Robotics": [
        "robotics", "robot", "robot building",
        "রোবোটিক্স", "রোবট"
    ],
    "Programming": [
        "programming", "coding", "competitive programming",
        "কোডিং", "প্রোগ্রামিং"
    ],
    "Physics": [
        "physics", "পদার্থবিজ্ঞান", "পদার্থ"
    ],
    "Mathematics": [
        "mathematics", "math", "calculus",
        "গণিত", "ক্যালকুলাস"
    ],
    "Biology": [
        "biology", "biotechnology",
        "জীববিজ্ঞান", "জীবপ্রযুক্তি"
    ]
}

# Broad terms should not be assigned to a specific category.
BROAD_KEYWORDS = [
    "science", "stem", "technology",
    "বিজ্ঞান", "প্রযুক্তি"
]

SIMILARITY_THRESHOLD = 0.60
CONFIDENCE_MARGIN = 0.05

print("Generating category embeddings...")

category_names = list(CATEGORIES.keys())

category_embeddings = model.encode(
    list(CATEGORIES.values()),
    max_length=128
)["dense_vecs"]

print("Category embeddings generated!")


def keyword_match(query):
    query_lower = query.lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            keyword_lower = keyword.lower()

            if re.search(
                r"(?<![a-z])" + re.escape(keyword_lower) + r"(?![a-z])",
                query_lower
            ):
                return category

            if re.search(r"[\u0980-\u09FF]", keyword):
                if keyword in query:
                    return category

    return None


def match_category(query):

    # First: Check for explicit category keywords.
    keyword_category = keyword_match(query)

    if keyword_category:
        print("Matched using category keyword:", keyword_category)
        return keyword_category, 1.0

    # Second: Avoid assigning broad queries to specific categories.
    query_lower = query.lower()

    for keyword in BROAD_KEYWORDS:
        if re.search(
            r"(?<![a-z])" + re.escape(keyword) + r"(?![a-z])",
            query_lower
        ):
            print("Broad topic detected. No specific category assigned.")
            return None, 0.0

        if re.search(r"[\u0980-\u09FF]", keyword):
            if keyword in query:
                print("Broad topic detected. No specific category assigned.")
                return None, 0.0

    # Third: Use BGE-M3 semantic matching.
    query_embedding = model.encode(
        [query],
        max_length=128
    )["dense_vecs"][0]

    similarities = np.dot(
        category_embeddings,
        query_embedding
    ) / (
        np.linalg.norm(category_embeddings, axis=1)
        * np.linalg.norm(query_embedding)
    )

    sorted_indices = np.argsort(similarities)[::-1]

    best_index = sorted_indices[0]
    second_index = sorted_indices[1]

    best_score = float(similarities[best_index])
    second_score = float(similarities[second_index])

    margin = best_score - second_score

    print("\nCategory similarity scores:")

    for index in sorted_indices:
        print(
            category_names[index],
            ":",
            round(float(similarities[index]), 4)
        )

    print("\nBest score:", round(best_score, 4))
    print("Confidence margin:", round(margin, 4))

    if best_score < SIMILARITY_THRESHOLD:
        return None, best_score

    if margin < CONFIDENCE_MARGIN:
        return None, best_score

    return category_names[best_index], best_score


if __name__ == "__main__":

    test_queries = [
        "science events",
        "STEM workshops",
        "technology events",
        "robotics workshops",
        "machine learning seminar",
        "physics competition",
        "বিজ্ঞান কর্মশালা",
        "প্রযুক্তি বিষয়ক অনুষ্ঠান"
    ]

    for query in test_queries:
        print("\n" + "=" * 50)
        print("Query:", query)

        category, score = match_category(query)

        print("Matched category:", category)
        print("Score:", round(score, 4))
