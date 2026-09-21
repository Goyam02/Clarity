"""Web-research columns on company profiles + CODE RED task titles.

Idempotent: on a fresh database 0001 already created every column via
create_all, so adds are skipped when the column exists (works on both
Postgres and SQLite batch mode).

revision = "0002_web_research"
down_revision = "0001_initial"
"""
revision = "0002_web_research"
down_revision = "0001_initial"

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

    _add_column_if_missing(inspector, "company_profiles",
        sa.Column("web_problems", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_if_missing(inspector, "company_profiles",
        sa.Column("web_interview_questions", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_if_missing(inspector, "company_profiles",
        sa.Column("web_researched_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing(inspector, "code_red_tasks",
        sa.Column("title", sa.String(length=500), nullable=False, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("code_red_tasks") as batch:
        batch.drop_column("title")
    with op.batch_alter_table("company_profiles") as batch:
        batch.drop_column("web_researched_at")
        batch.drop_column("web_interview_questions")
        batch.drop_column("web_problems")
