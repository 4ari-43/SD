import json
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Path
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from redis.exceptions import RedisError


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = Redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        socket_timeout=0.2, socket_connect_timeout=0.2, max_connections=64,
    )
    yield
    await app.state.redis.aclose()


app = FastAPI(lifespan=lifespan)


class Entry(BaseModel):
    value: Any
    ttl: int = Field(ge=1, le=86400)


def redis_key(key: str):
    return "opportunity-search:v1:" + key


@app.get("/cache/{key}")
async def get(key: str = Path(pattern=r"^(page|embedding):[a-fA-F0-9-]{1,64}$")):
    try:
        value = await app.state.redis.get(redis_key(key))
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Cache unavailable") from exc
    return {"value": json.loads(value) if value is not None else None}


@app.put("/cache/{key}")
async def put(body: Entry, key: str = Path(pattern=r"^(page|embedding):[a-fA-F0-9-]{1,64}$")):
    data = json.dumps(body.value, separators=(",", ":"), allow_nan=False)
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Cache entry too large")
    try:
        await app.state.redis.set(redis_key(key), data, ex=body.ttl)
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Cache unavailable") from exc
    return {"ok": True}
