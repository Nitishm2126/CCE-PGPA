from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """
    Test that the root endpoint GET / returns service information and online status.
    """
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["app_name"] == "CCE Achieve API"
    assert "Google Drive" in data["storage_architecture_mandate"]
    assert "PostgreSQL" in data["storage_architecture_mandate"]


def test_health_endpoint(client: TestClient):
    """
    Test that GET /api/v1/health returns health status, timestamp, and database connectivity info.
    """
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database" in data
    assert isinstance(data["database"]["connected"], bool)
    assert data["database"]["database"] == "cce_achieve"
    assert "Google Drive" in data["storage_rule"]
    assert "PostgreSQL" in data["storage_rule"]
