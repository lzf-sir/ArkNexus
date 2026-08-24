"""LLM catalog endpoint (read-only public-ish)."""
from __future__ import annotations

from fastapi import APIRouter

# The shared module is colocated at backend/shared. We add it to sys.path on
# startup (see app/main.py) so this import works regardless of the launch
# working directory.
import llm_catalog  # type: ignore[import-not-found]

router = APIRouter(tags=["llm-catalog"])


@router.get(
    "/llm/catalog",
    summary="Return the static list of supported LLM providers + models.",
)
async def get_llm_catalog() -> dict:
    return llm_catalog.to_catalog_dict()


@router.get(
    "/llm/providers",
    summary="Just the provider metadata (no model details).",
)
async def get_llm_providers() -> list[dict]:
    cat = llm_catalog.to_catalog_dict()
    # strip models for a slim response
    return [
        {k: v for k, v in p.items() if k != "models"}
        for p in cat["providers"]
    ]


@router.get(
    "/llm/providers/{provider_id}/models",
    summary="Models for a single provider.",
)
async def get_llm_models(provider_id: str) -> dict:
    p = llm_catalog.get_provider(provider_id)
    if p is None:
        return {"provider_id": provider_id, "models": []}
    return {
        "provider_id": provider_id,
        "provider_name": p["name"],
        "base_url": p["base_url"],
        "api_style": p["api_style"],
        "auth_header": p["auth_header"],
        "auth_prefix": p["auth_prefix"],
        "models": p["models"],
    }
