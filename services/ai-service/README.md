## Dependency installation

```shell
uv init ai-service
cd ai-service

uv add fastapi "uvicorn[standard]"

uv add install pydantic

uv add pydantic-settings

uv add langchain-openai

uv add sqlalchemy alembic asyncpg pgvector

uv run uvicorn main:app --reload --port 8080
```

## Creates the migration scripts

```shell
DEBUG=true uv run alembic revision --autogenerate -m "create knowledge tables"
```
