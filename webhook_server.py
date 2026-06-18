import os
import hmac
import hashlib
import logging
from fastapi import FastAPI, Request, HTTPException, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Optional
from latenode_client import LatenodeClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Latenode AI Webhook")

WEBHOOK_SECRET = os.getenv("LATENODE_WEBHOOK_SECRET", "")
CALLBACK_API_URL = os.getenv("LATENODE_CALLBACK_URL", "")  # 選填：收到事件後回呼另一個 Latenode workflow


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify Latenode webhook signature (HMAC-SHA256)."""
    if not secret:
        return True  # skip verification if secret not configured
    expected = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/webhook/latenode")
async def latenode_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_latenode_signature: Optional[str] = Header(None),
):
    body = await request.body()

    if WEBHOOK_SECRET and x_latenode_signature:
        if not verify_signature(body, x_latenode_signature, WEBHOOK_SECRET):
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info("Received Latenode webhook: %s", payload)

    event_type = payload.get("event") or payload.get("type", "unknown")
    data = payload.get("data", {})
    logger.info("Event type: %s, Data: %s", event_type, data)

    # 若有設定 CALLBACK_URL，在背景回呼另一個 Latenode workflow
    if CALLBACK_API_URL:
        background_tasks.add_task(_forward_to_latenode, event_type, data)

    return JSONResponse({"received": True, "event": event_type})


async def _forward_to_latenode(event_type: str, data: dict):
    try:
        client = LatenodeClient(api_url=CALLBACK_API_URL)
        result = await client.trigger_async({"event": event_type, "data": data})
        logger.info("Forwarded to Latenode, response: %s", result)
    except Exception as exc:
        logger.error("Failed to forward to Latenode: %s", exc)
