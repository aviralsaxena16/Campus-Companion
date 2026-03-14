def test_get_updates(client):

    headers = {"Authorization": "Bearer fake-token"}

    response = client.get("/api/updates", headers=headers)

    assert response.status_code in [200, 404]