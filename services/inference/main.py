import asyncio
import logging
import os
from contextlib import asynccontextmanager

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from huggingface_hub import hf_hub_download
from pydantic import BaseModel, Field, StringConstraints
from starlette.concurrency import run_in_threadpool
from tokenizers import Tokenizer
from typing import Annotated

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
EMBED_REVISION = os.getenv("EMBEDDING_REVISION", "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a")
RANK_MODEL = "cross-encoder/ms-marco-MiniLM-L6-v2"
RANK_REVISION = "233902d25c440f23af6f7d6e94d2946bac0bee0a"
INSTRUCTION = "Represent this sentence for searching relevant passages: "
ROLE = os.getenv("INFERENCE_ROLE", "online")
RANK_FILE = os.getenv("RERANK_ONNX_FILE", "onnx/model.onnx")
Text = Annotated[str, StringConstraints(min_length=1, max_length=12000)]


class EmbedRequest(BaseModel):
    texts: list[Text] = Field(min_length=1, max_length=32)
    query: bool = False


class RankRequest(BaseModel):
    query: Annotated[str, StringConstraints(min_length=1, max_length=256)]
    listings: list[Text] = Field(min_length=1, max_length=30)


class Encoder:
    def __init__(self, model: str, revision: str, graph: str, max_length: int):
        self.tokenizer = Tokenizer.from_file(hf_hub_download(model, "tokenizer.json", revision=revision))
        self.tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
        self.tokenizer.enable_truncation(max_length=max_length)
        config = ort.SessionOptions()
        config.intra_op_num_threads = int(os.getenv("ONNX_THREADS", "2"))
        config.inter_op_num_threads = 1
        self.session = ort.InferenceSession(
            hf_hub_download(model, graph, revision=revision),
            sess_options=config, providers=["CPUExecutionProvider"],
        )
        self.inputs = {item.name for item in self.session.get_inputs()}

    def predict(self, texts):
        encoded = self.tokenizer.encode_batch(texts)
        tensors = {
            "input_ids": [item.ids for item in encoded],
            "attention_mask": [item.attention_mask for item in encoded],
            "token_type_ids": [item.type_ids for item in encoded],
        }
        inputs = {key: np.asarray(tensors[key], dtype=np.int64) for key in self.inputs}
        return self.session.run(None, inputs)[0]

    def embed(self, texts):
        vectors = self.predict(texts)[:, 0, :]
        return (vectors / np.linalg.norm(vectors, axis=-1, keepdims=True)).tolist()

    def rank(self, pairs):
        scores = []
        for offset in range(0, len(pairs), 16):
            scores.extend(self.predict(pairs[offset:offset + 16]).reshape(-1).tolist())
        return scores


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.embedder = Encoder(EMBED_MODEL, EMBED_REVISION, "onnx/model.onnx", 512)
    app.state.ranker = None
    if ROLE == "online" and RANK_FILE:
        try:
            app.state.ranker = Encoder(RANK_MODEL, RANK_REVISION, RANK_FILE, 256)
        except Exception:
            logging.getLogger(__name__).exception("Reranker failed to start. Embeddings remain available.")
    app.state.embed_slots = asyncio.Semaphore(max(1, int(os.getenv("EMBED_CONCURRENCY", "2"))))
    app.state.rank_slots = asyncio.Semaphore(max(1, int(os.getenv("RERANK_CONCURRENCY", "2"))))
    yield


app = FastAPI(lifespan=lifespan)


async def infer(slots, operation, payload):
    if slots.locked():
        raise HTTPException(status_code=429, detail="Inference capacity exhausted")
    async with slots:
        return await run_in_threadpool(operation, payload)


@app.get("/health")
async def health():
    return {"ready": True, "embedding_revision": EMBED_REVISION, "rerank_graph": RANK_FILE if app.state.ranker else None}


@app.post("/embed")
async def embed(body: EmbedRequest):
    if body.query and (ROLE != "online" or len(body.texts) != 1 or len(body.texts[0]) > 256):
        raise HTTPException(status_code=422, detail="Invalid online embedding request")
    if not body.query and ROLE == "online":
        raise HTTPException(status_code=422, detail="Use the ingestion service for listing embeddings")
    texts = [INSTRUCTION + text for text in body.texts] if body.query else body.texts
    vectors = await infer(app.state.embed_slots, app.state.embedder.embed, texts)
    return {"version": f"{EMBED_MODEL}@{EMBED_REVISION}:listing-v1", "vectors": vectors}


@app.post("/rerank")
async def rerank(body: RankRequest):
    if app.state.ranker is None:
        raise HTTPException(status_code=503, detail="Reranking disabled")
    scores = await infer(app.state.rank_slots, app.state.ranker.rank, [(body.query, text) for text in body.listings])
    return {"scores": scores}
