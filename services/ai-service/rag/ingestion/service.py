import uuid
from rag.ingestion.chunker import chunk_text
from db.session import AsyncSessionLocal
from db.models import KnowledgeDocument
from db.models import KnowledgeChunk
from llm.clients import embeddings


async def ingest_document(
        tenant_id:uuid.UUID,
        title:str,
        version:int,
        content:str,
        source_type:str="policy",
        status:str="active"
):
    if len(content) == 0:
        raise ValueError("received empty content for chunking")

    chunk_docs = chunk_text(content)
    chunk_embeddings = await embeddings.aembed_documents(chunk_docs)
    document = KnowledgeDocument(
            tenant_id=tenant_id,
            title=title,
            version=version,
            status=status,
            source_type=source_type
            )

    async with AsyncSessionLocal() as session:
            async with session.begin():
                 session.add(document)
                 await session.flush()
                 print("document id :",document.id)

                 for index, (content, embedding) in enumerate(zip(chunk_docs, chunk_embeddings)):
                     chunk = KnowledgeChunk(
                          tenant_id=tenant_id,
                          document_id= document.id,
                          chunk_index = index,
                          embedding=embedding,
                          content=content
                     )
                     session.add(chunk)

            print("Chunk committed successfully ")
    return document.id
