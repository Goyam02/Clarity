"""Platform signals (LeetCode pulls) on profiles.

Idempotent, mirroring 0002: on a fresh database create_all already made the
columns/tables, so adds are skipped when they exist.

revision = "0003_platform_signals"
down_revision = "0002_web_research"
"""
revision = "0003_platform_signals"
down_revision = "0002_web_research"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector


def _add_column_if_missing(inspector: Inspector, table: str, column: sa.Column) -> None:
    if column.name in {c["name"] for c in inspector.get_columns(table)}:
        return
    with op.batch_alter_table(table) as batch:
        batch.add_column(column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector(bind)

    _add_column_if_missing(inspector, "profiles",
        sa.Column("leetcode_session_encrypted", sa.Text(), nullable=False, server_default=""))
    _add_column_if_missing(inspector, "profiles",
        sa.Column("leetcode_csrf_encrypted", sa.Text(), nullable=False, server_default=""))
    _add_column_if_missing(inspector, "profiles",
        sa.Column("leetcode_username", sa.String(length=64), nullable=False, server_default=""))
    _add_column_if_missing(inspector, "profiles",
        sa.Column("leetcode_synced_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing(inspector, "profiles",
        sa.Column("leetcode_last_error", sa.String(length=64), nullable=False, server_default=""))
    _add_column_if_missing(inspector, "profiles",
        sa.Column("codeforces_synced_at", sa.DateTime(timezone=True), nullable=True))

    if "platform_signals" not in inspector.get_table_names():
        op.create_table(
            "platform_signals",
            sa.Column("id", sa.String(length=32), primary_key=True),
            sa.Column("user_id", sa.String(length=32),
                      sa.ForeignKey("users.id"), index=True, nullable=False),
            sa.Column("platform", sa.String(length=16), index=True, nullable=False),
            sa.Column("signal_type", sa.String(length=32), nullable=False),
            sa.Column("topic_id", sa.String(length=64), default="", index=True),
            sa.Column("value", sa.JSON(), nullable=False),
            sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector(bind)
    if "platform_signals" in inspector.get_table_names():
        op.drop_table("platform_signals")
    with op.batch_alter_table("profiles") as batch:
        batch.drop_column("codeforces_synced_at")
        batch.drop_column("leetcode_last_error")
        batch.drop_column("leetcode_synced_at")
        batch.drop_column("leetcode_username")
        batch.drop_column("leetcode_csrf_encrypted")
        batch.drop_column("leetcode_session_encrypted")
