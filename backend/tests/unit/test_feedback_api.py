def test_feedback_submission(client):

    payload = {
        "update_id": 1,
        "is_correct": False
    }

    headers = {"Authorization": "Bearer fake-token"}

    response = client.post("/api/updates/feedback", json=payload, headers=headers)

    assert response.status_code in [200, 404]