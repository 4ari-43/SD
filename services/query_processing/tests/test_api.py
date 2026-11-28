
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_home_endpoint():

    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "STEM Event Discovery API is running!"


def test_health_endpoint():

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_empty_query():

    response = client.post(
        "/process-query",
        json={"query": ""}
    )

    assert response.status_code == 422


def test_whitespace_query():

    response = client.post(
        "/process-query",
        json={"query": "   "}
    )

    assert response.status_code == 400


def test_long_query():

    response = client.post(
        "/process-query",
        json={"query": "a" * 501}
    )

    assert response.status_code == 422
