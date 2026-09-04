"""System endpoints for ai-service: bulk export."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserDep, db_session
from app.services.export import EXPORT_MANIFEST_VERSION, build_export

router = APIRouter(prefix="/ai/system", tags=["ai-system"])


@router.get(
    "/export",
    summary="Export all conversations for the current user",
    response_class=StreamingResponse,
)
async def export_data(
    session: Annotated[AsyncSession, Depends(db_session)],
    user: Annotated[object, CurrentUserDep],
) -> StreamingResponse:
    blob, counts = await build_export(session, user.id)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"arknexus-ai-export-{stamp}.zip"
    quoted = f"attachment; filename=\"{filename}\"; filename*=UTF-8''{filename}"

    return StreamingResponse(
        iter([blob]),
        media_type="application/zip",
        headers={
            "Content-Disposition": quoted,
            "X-Export-Version": str(EXPORT_MANIFEST_VERSION),
            "X-Export-Count-Conversations": str(counts.conversations),
            "X-Export-Count-Messages": str(counts.messages),
        },
    )