# Python AI service

- Keep FastAPI routes thin and asynchronous. Use Pydantic request and response schemas, including `response_model` on routes.
- Keep LLM construction in `llm/clients.py`, prompts in `prompts/`, and reasoning orchestration outside route handlers.
- Return structured Pydantic results for analysis consumed by the API. Include evidence references where a result relies on retrieved knowledge.
- Keep document ingestion, chunking, embedding, retrieval, and generation in their existing `rag/` areas. Scope retrieval by tenant and distinguish policy knowledge from operational facts supplied by NestJS.
- Do not write supply-chain state or execute recommended actions. Return analysis to NestJS for review and any authorized execution.
- Add automated tests with mocked LLM, embedding, and database calls for schemas, retrieval boundaries, and reasoning behavior. Keep live-service scripts separate from the normal test suite.
