from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200

def test_predict_dummy():
    payload = {
        "subject": "Career Fair",
        "body": "There is a hiring drive on campus"
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    assert "label" in res.json()
