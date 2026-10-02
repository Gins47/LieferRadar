from langchain_openai import OpenAIEmbeddings
from config.config import settings

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    api_key=settings.openai_api_key,
)
