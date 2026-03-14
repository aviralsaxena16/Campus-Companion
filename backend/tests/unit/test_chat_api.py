from fastapi.testclient import TestClient
from unittest.mock import patch

def test_chat_stream(client: TestClient):

    payload = {
        "message": "Hello",
        "access_token": "fake-token"
    }

    headers = {"Authorization": "Bearer fake-token"}

    with patch("app.agent.orchestrator.get_agent_response") as mock_agent:
        mock_agent.return_value = None

        response = client.post("/api/chat/stream", json=payload, headers=headers)

        assert response.status_code == 200