from fastapi.testclient import TestClient
from app.main import app
import os

# Mock environment variables so tests don't crash
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "fake-key"
os.environ["GROQ_API_KEY"] = "fake-key"

client = TestClient(app)

def test_read_root():
    """
    Sanity check: Ensure the API starts and returns the welcome message.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Backend is connected and running!"}