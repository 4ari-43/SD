
import re
from datetime import datetime, date, timedelta

from category_matcher import match_category
from embedding_generator import generate_query_embedding
from config import MODEL_NAME


# ==========================================
# 1. QUERY NORMALIZATION
# ==========================================

def normalize_query(query):

    query = query.strip().lower()
    query = re.sub(r"\s+", " ", query)

    return query


# ==========================================
# 2. LANGUAGE DETECTION
# ==========================================

def detect_language(query):

    bangla_pattern = re.compile(r'[\u0980-\u09FF]')

    romanized_bangla_words = {
        "ami", "amra", "chai", "khujchi", "khujbo",
        "khuji", "kothay", "dhakay", "te", "jonno",
        "ache", "nei", "hobe", "kobe", "korbo",
        "lagbe", "ki", "kon", "ebong", "er"
    }

    has_bangla_script = bool(bangla_pattern.search(query))

    words = set(re.findall(r'\b[a-z]+\b', query.lower()))

    has_romanized_bangla = bool(words & romanized_bangla_words)

    if has_bangla_script and re.search(r'[a-zA-Z]', query):
        return "mixed"

    if has_bangla_script:
        return "bangla"

    if has_romanized_bangla:
        return "romanized_bangla"

    return "english"


# ==========================================
# 3. LOCATION EXTRACTION
# ==========================================

def extract_location(query):

    locations = {
        "Dhaka": ["dhaka", "ঢাকা", "ঢাকায়", "ঢাকাতে", "dhakay"],
        "Chittagong": ["chittagong", "চট্টগ্রাম", "ctg"],
        "Rajshahi": ["rajshahi", "রাজশাহী"],
        "Khulna": ["khulna", "খুলনা"],
        "Sylhet": ["sylhet", "সিলেট"],
        "Gazipur": ["gazipur", "গাজীপুর"],
        "Cumilla": ["cumilla", "কুমিল্লা", "comilla"],
        "Barishal": ["barishal", "বরিশাল"],
        "Rangpur": ["rangpur", "রংপুর"],
        "Mymensingh": ["mymensingh", "ময়মনসিংহ"]
    }

    query = query.lower()

    for city, keywords in locations.items():

        for keyword in keywords:

            if keyword in query:
                return city

    return None


# ==========================================
# 4. CATEGORY EXTRACTION
# ==========================================

def extract_category(query):

    category, score = match_category(query)

    return category


# ==========================================
# 5. EVENT TYPE EXTRACTION
# ==========================================

def extract_event_type(query):

    event_types = {
       "Workshop": [
    "workshop",
    "workshops",
    "কর্মশালা",
    "ওয়ার্কশপ",
    "ওয়ার্কশপ"
],
        "Competition": [
            "competition", "competitions",
            "contest", "contests", "প্রতিযোগিতা"
        ],
        "Seminar": [
            "seminar", "seminars", "সেমিনার"
        ],
        "Conference": [
            "conference", "conferences", "সম্মেলন"
        ],
        "Hackathon": [
            "hackathon", "hackathons"
        ],
        "Bootcamp": [
            "bootcamp", "bootcamps"
        ],
        "Webinar": [
            "webinar", "webinars"
        ],
        "Exhibition": [
            "exhibition", "exhibitions", "প্রদর্শনী"
        ],
        "Olympiad": [
            "olympiad", "olympiads", "অলিম্পিয়াড"
        ],
        "Training": [
            "training", "trainings", "প্রশিক্ষণ"
        ],
        "Event": [
            "event", "events", "ইভেন্ট", "অনুষ্ঠান"
        ]
    }

    for event_type, keywords in event_types.items():

        for keyword in keywords:

            if re.search(
                r"(?<![a-z])" + re.escape(keyword) + r"(?![a-z])",
                query
            ):
                return event_type

    return None


# ==========================================
# 6. DATE EXTRACTION
# ==========================================

def extract_date(query):

    query = query.lower()

    today = date.today()

    def make_date_result(expression, start, end):

        return {
            "date_expression": expression,
            "date_from": start.isoformat(),
            "date_to": end.isoformat()
        }

    # Today and tomorrow

    relative_dates = {
        "today": "today",
        "tomorrow": "tomorrow",
        "আজ": "today",
        "আজকে": "today",
        "আগামীকাল": "tomorrow"
    }

    for keyword, expression in relative_dates.items():

        if keyword in query:

            if expression == "today":

                return make_date_result(
                    expression, today, today
                )

            if expression == "tomorrow":

                tomorrow = today + timedelta(days=1)

                return make_date_result(
                    expression, tomorrow, tomorrow
                )

    # This week and next week

    week_expressions = {
        "this week": "this_week",
        "এই সপ্তাহে": "this_week",
        "next week": "next_week",
        "আগামী সপ্তাহে": "next_week"
    }

    for keyword, expression in week_expressions.items():

        if keyword in query:

            monday = today - timedelta(days=today.weekday())

            if expression == "next_week":
                monday += timedelta(days=7)

            sunday = monday + timedelta(days=6)

            return make_date_result(
                expression, monday, sunday
            )

    # This month and next month

    month_expressions = {
        "this month": "this_month",
        "এই মাসে": "this_month",
        "next month": "next_month",
        "আগামী মাসে": "next_month"
    }

    for keyword, expression in month_expressions.items():

        if keyword in query:

            if expression == "this_month":

                first_day = today.replace(day=1)

            else:

                if today.month == 12:

                    first_day = date(
                        today.year + 1, 1, 1
                    )

                else:

                    first_day = date(
                        today.year, today.month + 1, 1
                    )

            if first_day.month == 12:

                next_month_first = date(
                    first_day.year + 1, 1, 1
                )

            else:

                next_month_first = date(
                    first_day.year, first_day.month + 1, 1
                )

            last_day = next_month_first - timedelta(days=1)

            return make_date_result(
                expression, first_day, last_day
            )

    # Specific date: YYYY-MM-DD

    match = re.search(
        r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b",
        query
    )

    if match:

        try:

            date_value = datetime.strptime(
                match.group(0), "%Y-%m-%d"
            ).date()

            return make_date_result(
                None, date_value, date_value
            )

        except ValueError:
            pass

    # No date detected

    return {
        "date_expression": None,
        "date_from": None,
        "date_to": None
    }


# ==========================================
# 7. KEYWORD EXTRACTION
# ==========================================

def extract_keywords(query):

    stop_words = {

        # General English words
        "find", "show", "me", "the", "a", "an",
        "in", "at", "near", "for", "of", "to",
        "and", "please", "on", "about",

        # Event-related words handled separately
        "events", "event",
        "workshop", "workshops",
        "competition", "competitions",
        "contest", "contests",
        "seminar", "seminars",
        "conference", "conferences",
        "hackathon", "hackathons",
        "bootcamp", "bootcamps",
        "webinar", "webinars",
        "exhibition", "exhibitions",
        "olympiad", "olympiads",
        "training", "trainings",

        # Date-related words
        "today", "tomorrow",
        "this", "next", "week", "month",

        # Romanized Bangla
        "ami", "amra", "chai", "khujchi",
        "khujbo", "khuji", "dhakay",
        "te", "jonno", "ache", "nei",
        "aj", "ajke", "agamikal",

        # Bangla words
        "খুঁজছি", "খুঁজে", "দেখাও", "আমাকে",
        "এর", "এবং", "তে", "জন্য", "একটি",
        "আজ", "আজকে", "আগামীকাল",
        "এই", "সপ্তাহে", "আগামী", "মাসে"
    }

    location_words = {
        "dhaka", "ঢাকা", "ঢাকায়", "ঢাকাতে",
        "chittagong", "চট্টগ্রাম", "ctg",
        "rajshahi", "রাজশাহী",
        "khulna", "খুলনা",
        "sylhet", "সিলেট",
        "gazipur", "গাজীপুর",
        "cumilla", "কুমিল্লা", "comilla",
        "barishal", "বরিশাল",
        "rangpur", "রংপুর",
        "mymensingh", "ময়মনসিংহ"
    }

    words = re.findall(
        r"[a-zA-Z0-9]+|[\u0980-\u09FF]+",
        query.lower()
    )

    keywords = []

    for word in words:

        if word in stop_words:
            continue

        if word in location_words:
            continue

        if word.isdigit():
            continue

        if word not in keywords:
            keywords.append(word)

    return keywords


# ==========================================
# 8. MAIN QUERY PROCESSING PIPELINE
# ==========================================

def process_query(query):

    normalized = normalize_query(query)

    result = {
        "original_query": query,
        "normalized_query": normalized,
        "language": detect_language(query),
        "location": extract_location(normalized),
        "category": extract_category(normalized),
        "event_type": extract_event_type(normalized),
        "date": extract_date(normalized),
        "keywords": extract_keywords(normalized)
    }

    return result


# ==========================================
# 9. CREATE FINAL SEARCH REQUEST
# ==========================================

def create_search_request(query):

    normalized = normalize_query(query)

    processed_data = process_query(normalized)

    embedding = generate_query_embedding(normalized)

    processed_data["embedding_model"] = MODEL_NAME
    processed_data["embedding_dimensions"] = len(embedding)
    processed_data["query_embedding"] = embedding

    return processed_data


# ==========================================
# 10. TESTING
# ==========================================

if __name__ == "__main__":

    test_queries = [
        "Find robotics workshops in Dhaka",
        "Find science events tomorrow",
        "Find programming events today",
        "Find STEM workshops this week",
        "Find AI seminars next week",
        "Find robotics competitions this month",
        "Find physics events next month",
        "Find workshops on 2026-12-15",
        "ঢাকায় AI কর্মশালা আগামীকাল"
    ]

    for query in test_queries:

        print("\n" + "=" * 60)
        print("Original Query:", query)

        result = process_query(query)

        for key, value in result.items():

            print(key, ":", value)
