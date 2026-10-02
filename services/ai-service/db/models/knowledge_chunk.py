import uuid
from datetime import datetime
from typing import  Any

from sqlalchemy import DateTime, Text, func, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import mapped_column, Mapped

from pgvector.sqlalchemy import Vector

from db.base import Base

class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__= ( 
        UniqueConstraint("document_id","chunk_index", name="uq_document_chunk"), 
        {"schema":"ai"} 
        )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
        )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        )

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai.knowledge_documents.id"), 
        nullable=False
        )

    chunk_index: Mapped[int] = mapped_column(nullable=False)

    embedding: Mapped[list[float]] = mapped_column(
        Vector(1536),
        nullable=False
        )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
        )

    document_metadata: Mapped[dict[str , Any] | None] = mapped_column(
        JSONB, 
        nullable=True
        )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )




    


