
from query_processor import (
    normalize_query,
    detect_language,
    extract_location,
    extract_category,
    extract_event_type,
    extract_date,
    extract_keywords,
    process_query
)


def test_normalize_query():
    assert normalize_query("  FIND   ROBOTICS  ") == "find robotics"


def test_detect_english():
    assert detect_language("Find robotics events") == "english"


def test_detect_bangla():
    assert detect_language("রোবটিক্স ইভেন্ট খুঁজছি") == "bangla"


def test_detect_mixed():
    assert detect_language("ঢাকায় robotics events") == "mixed"


def test_detect_romanized_bangla():
    assert detect_language("Ami Dhakay event khujchi") == "romanized_bangla"


def test_extract_location():
    assert extract_location("find events in dhaka") == "Dhaka"


def test_extract_category():
    assert extract_category("robotics workshop") == "Robotics"


def test_extract_event_type():
    assert extract_event_type("find programming workshops") == "Workshop"


def test_extract_date():
    result = extract_date("find events tomorrow")

    assert result["date_expression"] == "tomorrow"
    assert result["date_from"] is not None
    assert result["date_to"] is not None


def test_extract_keywords():
    assert extract_keywords("find robotics workshops in dhaka") == ["robotics"]


def test_process_query():
    result = process_query("Find robotics workshops in Dhaka")

    assert result["language"] == "english"
    assert result["location"] == "Dhaka"
    assert result["category"] == "Robotics"
    assert result["event_type"] == "Workshop"
    assert "robotics" in result["keywords"]
