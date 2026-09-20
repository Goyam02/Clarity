"""Initial schema (all models).

Creates every table from app.models metadata. This keeps `alembic upgrade
head` sufficient on a fresh Postgres database (docker compose boot) without
needing create_all, while remaining idempotent with existing databases via
the alembic_version stamp.
"""
revision = "0001_initial"
down_revision = None

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

from app.db.base import Base
import app.models  # noqa: F401  (register metadata)


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
