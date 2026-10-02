"""create knowledge tables

Revision ID: 2cc73aa4ae2d
Revises:
Create Date: 2026-09-14 14:23:04.337810
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = "2cc73aa4ae2d"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create AI knowledge schema and tables."""

    # Alembic does not automatically create PostgreSQL schemas
    # referenced by SQLAlchemy models.
    op.execute("CREATE SCHEMA IF NOT EXISTS ai")

    # ---------------------------------------------------------
    # knowledge_documents
    # ---------------------------------------------------------
    op.create_table(
        "knowledge_documents",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "source_type",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="ai",
    )

    op.create_index(
        op.f("ix_ai_knowledge_documents_tenant_id"),
        "knowledge_documents",
        ["tenant_id"],
        unique=False,
        schema="ai",
    )

    # ---------------------------------------------------------
    # knowledge_chunks
    # ---------------------------------------------------------
    op.create_table(
        "knowledge_chunks",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "chunk_index",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "embedding",
            Vector(1536),
            nullable=False,
        ),
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "document_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["ai.knowledge_documents.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_document_chunk",
        ),
        schema="ai",
    )

    op.create_index(
        op.f("ix_ai_knowledge_chunks_tenant_id"),
        "knowledge_chunks",
        ["tenant_id"],
        unique=False,
        schema="ai",
    )


def downgrade() -> None:
    """Remove AI knowledge tables."""

    # Child table must be removed first because it references
    # knowledge_documents through a foreign key.
    op.drop_index(
        op.f("ix_ai_knowledge_chunks_tenant_id"),
        table_name="knowledge_chunks",
        schema="ai",
    )

    op.drop_table(
        "knowledge_chunks",
        schema="ai",
    )

    op.drop_index(
        op.f("ix_ai_knowledge_documents_tenant_id"),
        table_name="knowledge_documents",
        schema="ai",
    )

    op.drop_table(
        "knowledge_documents",
        schema="ai",
    )