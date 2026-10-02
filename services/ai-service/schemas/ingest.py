import uuid
from pydantic import BaseModel

class IngestDocumentResult(BaseModel):
    document_id: uuid.UUID