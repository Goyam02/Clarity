"""Initial schema (all models)."""
revision = "0001_initial"
down_revision = None

from alembic import op  # noqa: F401


def upgrade() -> None:
    # Schema is managed via app.models metadata (autogenerate in real runs);
    # sqlite/local boots via Base.metadata.create_all. This revision marks baseline.
    pass


def downgrade() -> None:
    pass
