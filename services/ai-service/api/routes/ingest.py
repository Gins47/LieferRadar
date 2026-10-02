
from fastapi import APIRouter, HTTPException
from schemas.rag import IngestDocumentRequest
from rag.ingestion.service import ingest_document
from schemas.ingest import IngestDocumentResult

router = APIRouter(prefix="/ingest",tags=["ingestion"])

@router.post("/document",response_model=IngestDocumentResult)
async def process_ingest_document(request:IngestDocumentRequest):
    try:
        document_id = await(
            ingest_document(
                request.tenant_id,
                request.title,
                request.version,
                request.content,
                request.source_type,
              )
            )
        return {"document_id": document_id}

    except Exception as e:
        print(f"Error occurred while ingesting document {e}")
        raise HTTPException("Internal error occurred")

