"""Database connection, session management, and Base definition."""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

# Configure SQLite engine
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session and closes it cleanly."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all registered database tables and apply safe schema updates."""
    import app.models  # noqa: F401 - ensure models are registered
    Base.metadata.create_all(bind=engine)

    # Safe column migrations for SQLite
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "files" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("files")]
        with engine.connect() as conn:
            if "file_size" not in columns:
                conn.execute(text("ALTER TABLE files ADD COLUMN file_size INTEGER DEFAULT 0"))
                conn.commit()
            if "error_message" not in columns:
                conn.execute(text("ALTER TABLE files ADD COLUMN error_message TEXT"))
                conn.commit()

