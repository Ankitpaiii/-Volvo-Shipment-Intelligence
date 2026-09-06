"""Isolated test DB + TestClient (no lifespan, no real DB writes)."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture(scope="session")
def _engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture()
def db(_engine):
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    """TestClient WITHOUT lifespan (lifespan would seed the real DB file)."""

    def _override():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    c = TestClient(app, raise_server_exceptions=False)
    try:
        yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
