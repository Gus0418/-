import os
import hmac
import hashlib
import logging
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Latenode AI Webhook")

WEBHOOK_SECRET = os.getenv("LATENODE_WEBHOOK_SECRET", "")


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

    # TODO: 在這裡加入您的業務邏輯
    event_type = payload.get("event") or payload.get("type", "unknown")
    data = payload.get("data", {})

    logger.info("Event type: %s, Data: %s", event_type, data)

    return JSONResponse({"received": True, "event": event_type})
