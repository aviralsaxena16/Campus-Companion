import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user, VerifiedUser
from app.database import engine
from app import models


def override_get_current_user():
    return VerifiedUser(email="test@example.com", name="Test User")


app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.fixture
def client():
    # Create tables
    models.Base.metadata.create_all(bind=engine)
    return TestClient(app)