"""Web-research columns on company profiles + CODE RED task titles.

revision = "0002_web_research"
down_revision = "0001_initial"
"""
revision = "0002_web_research"
down_revision = "0001_initial"

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    with op.batch_alter_table("company_profiles") as batch:
        batch.add_column(sa.Column("web_problems", sa.JSON(),
                                   nullable=False, server_default="[]"))
        batch.add_column(sa.Column("web_interview_questions", sa.JSON(),
                                   nullable=False, server_default="[]"))
        batch.add_column(sa.Column("web_researched_at", sa.DateTime(timezone=True),
                                   nullable=True))
    with op.batch_alter_table("code_red_tasks") as batch:
        batch.add_column(sa.Column("title", sa.String(length=500),
                                   nullable=False, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("code_red_tasks") as batch:
        batch.drop_column("title")
    with op.batch_alter_table("company_profiles") as batch:
        batch.drop_column("web_researched_at")
        batch.drop_column("web_interview_questions")
        batch.drop_column("web_problems")
