import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .db import init_db
from .auth import router as auth_router, seed_admin
from .intake import router as intake_router, llm_settings
from .workflow import router as workflow_router, run_review_job
from .voice import router as voice_router
from .catalog import CATALOG


async def review_loop():
    while True:
        try:
            await asyncio.to_thread(run_review_job)
        except Exception:
            logging.exception(
                "Scheduled complaint review failed; retrying next minute."
            )
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app):
    init_db()
    seed_admin()
    run_review_job()
    task = asyncio.create_task(review_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="Samadhan AI", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        s.strip()
        for s in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if s.strip()
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
for router in [auth_router, intake_router, workflow_router, voice_router]:
    app.include_router(router)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "otp_delivery": "screen",
        "chat_configured": bool(llm_settings()["key"] and llm_settings()["model"]),
        "voice_configured": all(
            bool(os.getenv(k))
            for k in ["VAPI_PUBLIC_KEY", "VAPI_ASSISTANT_ID", "VAPI_WEBHOOK_SECRET"]
        ),
    }


@app.get("/api/catalog")
def catalog():
    # Keywords are only for local suggestions; no personal information is public.
    return CATALOG


# npm run build makes the entire app available from the same backend URL.
DIST = Path(__file__).resolve().parents[2] / "frontend/dist"
if (DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/")
def home():
    if not (DIST / "index.html").exists():
        return {
            "message": "Run the frontend dev server on port 5173, or run npm run build in frontend."
        }
    return FileResponse(DIST / "index.html")
