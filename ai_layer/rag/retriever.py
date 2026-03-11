from pathlib import Path
from typing import List, Dict, Any

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

BASE_DIR = Path(__file__).resolve().parent
INDEX_DIR = BASE_DIR / "index"

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL_NAME)
_db = None


def _load_db():
    global _db
    if _db is None:
        if not INDEX_DIR.exists():
            raise RuntimeError("RAG index not found. Run: python rag/build_index.py")
        _db = FAISS.load_local(
            str(INDEX_DIR),
            _embeddings,
            allow_dangerous_deserialization=True
        )
    return _db


def retrieve(query: str, k: int = 4) -> List[Dict[str, Any]]:
    """
    Returns top-k chunks:
    [
      {"text": "...", "source_file": "abc.pdf", "page": 3},
      ...
    ]
    """
    db = _load_db()
    docs = db.similarity_search(query, k=k)

    results = []
    for d in docs:
        results.append({
            "text": d.page_content,
            "source_file": d.metadata.get("source_file", d.metadata.get("source", "unknown")),
            "page": d.metadata.get("page", None),
        })
    return results
