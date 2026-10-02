from fastapi import FastAPI
from dotenv import load_dotenv
from api.routes.ingest import router as ingest_router

load_dotenv()

app = FastAPI()

app.include_router(ingest_router)
