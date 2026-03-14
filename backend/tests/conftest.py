import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user, VerifiedUser


def override_get_current_user():
    return VerifiedUser(email="test@example.com", name="Test User")


app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.fixture
def client():
    return TestClient(app)