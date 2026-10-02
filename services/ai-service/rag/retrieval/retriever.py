import uuid
from db.session import AsyncSessionLocal
from db.models import KnowledgeChunk
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from llm.clients import embeddings
from schemas.rag import RetrievedChunk

async def retrieve_chunks(tenant_id:uuid.UUID,query:str,top_k:int=5,max_distance:float |None = None)->list[RetrievedChunk]:
     embedding_query = await embeddings.aembed_query(query)
     async with AsyncSessionLocal() as session:
            distance = KnowledgeChunk.embedding.cosine_distance(embedding_query).label("distance")
            stmt = (
                    select(KnowledgeChunk, distance)
                    .where(KnowledgeChunk.tenant_id == tenant_id)
                    .order_by(distance)
                    .limit(top_k)
                    )
            compiled = stmt.compile(dialect=postgresql.dialect())
            print(f"SQL = {compiled}")

            result = await session.execute(stmt)

            rows = result.all()
            print("TOTAL CHUNKS = ", len(rows))

            retrieved_chunks = [
                  RetrievedChunk(
                        chunk_id= chunk.id,
                        document_id=chunk.document_id,
                        content=chunk.content,
                        distance=distance_value
                  )

                  for chunk, distance_value in rows
            ]

            return retrieved_chunks
                 