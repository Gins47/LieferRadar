import uuid

from pydantic import BaseModel

class IngestDocumentRequest(BaseModel):
    tenant_id: uuid.UUID
    title: str
    version:int
    content:str
    source_type:str

class RetrievedChunk(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    content: str
    distance: float

class RAGReference(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    distance: float

class GroundedAnswer(BaseModel):
    answer: str
    source_chunk_ids: list[uuid.UUID]