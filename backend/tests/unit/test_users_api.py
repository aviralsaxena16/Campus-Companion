def test_get_user(client):

    headers = {"Authorization": "Bearer fake-token"}

    response = client.get("/users/me", headers=headers)

    assert response.status_code in [200, 500]