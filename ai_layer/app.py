import os
from typing import List, Optional, Literal
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from anthropic import Anthropic
from rag.retriever import retrieve

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
PY_PORT = int(os.getenv("PY_PORT", "8000"))

if not ANTHROPIC_API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY is missing in ai_layer/.env")

client = Anthropic(api_key=ANTHROPIC_API_KEY)

app = FastAPI(
    title="AI Layer (Anthropic + Local RAG)",
    version="1.0.0",
    description="FastAPI service with local-embedding RAG over PDFs + Anthropic generation."
)

Role = Literal["system", "user", "assistant"]


class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, examples=["What is in the PDF about refunds?"])
    history: Optional[List[ChatMessage]] = None
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=400, ge=1, le=2000)
    top_k: int = Field(default=4, ge=1, le=10)


class Source(BaseModel):
    source_file: str
    page: Optional[int] = None


class ChatResponse(BaseModel):
    reply: str
    sources: List[Source] = []


@app.get("/health")
def health():
    return {"ok": True, "service": "ai-layer-rag", "model": ANTHROPIC_MODEL}


def extract_text(content_blocks) -> str:
    parts = []
    for b in content_blocks or []:
        if getattr(b, "type", None) == "text":
            parts.append(getattr(b, "text", ""))
    return "".join(parts).strip()


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        # 1) Retrieve context from PDFs
        contexts = retrieve(req.message, k=req.top_k)

        context_text = "\n\n".join(
            [
                f"[Source: {c['source_file']}{'' if c['page'] is None else f', page {c['page']}'}]\n{c['text']}"
                for c in contexts
            ]
        )

        # 2) Strong grounding instruction (reduce hallucinations)
        system_prompt = (
            "You are a helpful assistant.\n"
            "Use ONLY the CONTEXT provided to answer.\n"
            "If the answer is not in the context, say: "
            "'I don’t have that information in my documents.'\n"
            "When you use a fact from the context, cite it like (Source: filename.pdf).\n\n"
            f"CONTEXT:\n{context_text}\n"
        )

        # 3) Build chat messages
        messages = []
        if req.history:
            messages.extend([{"role": m.role, "content": m.content} for m in req.history])

        messages.append({"role": "user", "content": req.message})

        # 4) Call Anthropic
        resp = client.messages.create(
            model=ANTHROPIC_MODEL,
            system=system_prompt,
            messages=messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )

        reply = extract_text(resp.content) or "(No text returned)"

        # 5) Return sources (unique)
        seen = set()
        sources: List[Source] = []
        for c in contexts:
            key = (c["source_file"], c.get("page"))
            if key not in seen:
                seen.add(key)
                sources.append(Source(source_file=c["source_file"], page=c.get("page")))

        return ChatResponse(reply=reply, sources=sources)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG chat failed: {str(e)}")