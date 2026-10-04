import os

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from config.config import settings
from schemas.disruption import LlmDisruptionReasoning

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    api_key=settings.openai_api_key,
)


def create_disruption_assessment_llm():
    client = ChatOpenAI(
        model=os.getenv("OPENAI_DISRUPTION_MODEL", "gpt-4o-mini"),
        api_key=settings.openai_api_key,
        temperature=0,
        timeout=25,
        max_retries=0,
    )
    return client.with_structured_output(LlmDisruptionReasoning, method="json_schema")
