"""Folders / labels / trash endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_optional, db_session
from app.models.user import User
from app.schemas.organization import (
    FolderCreate,
    FolderRead,
    FolderUpdate,
    LabelCreate,
    LabelRead,
    LabelUpdate,
    MessageLabelRead,
    MessageLabelUpdate,
)
from app.services import organization_service

router = APIRouter(tags=["organization"])


async def _owner(user: Optional[User]) -> Optional[str]:
    return user.id if user is not None else None


# ===== Folders =====

@router.get(
    "/folders",
    response_model=list[FolderRead],
    summary="List folders visible to the caller (system + custom).",
)
async def list_folders_endpoint(
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> list[FolderRead]:
    await organization_service.ensure_system_folders(session)
    return await organization_service.list_folders(session, await _owner(user))


@router.post(
    "/folders",
    response_model=FolderRead,
    status_code=201,
    summary="Create a custom folder for the caller.",
)
async def create_folder_endpoint(
    payload: FolderCreate,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> FolderRead:
    if user is None:
        raise HTTPException(status_code=401, detail="登录后可以创建自定义文件夹")
    return await organization_service.create_folder(session, user.id, payload)


@router.patch(
    "/folders/{folder_id}",
    response_model=FolderRead,
    summary="Rename a custom folder.",
)
async def update_folder_endpoint(
    folder_id: str,
    payload: FolderUpdate,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> FolderRead:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    try:
        return await organization_service.update_folder(session, folder_id, user.id, payload)
    except organization_service.FolderNotFound as exc:
        raise HTTPException(status_code=404, detail="Folder not found") from exc


@router.delete(
    "/folders/{folder_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
    summary="Delete a custom folder (system folders cannot be deleted).",
)
async def delete_folder_endpoint(
    folder_id: str,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> None:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    try:
        await organization_service.delete_folder(session, folder_id, user.id)
    except organization_service.FolderNotFound as exc:
        raise HTTPException(status_code=404, detail="Folder not found") from exc


# ===== Labels =====

@router.get(
    "/labels",
    response_model=list[LabelRead],
    summary="List the caller's labels.",
)
async def list_labels_endpoint(
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> list[LabelRead]:
    if user is None:
        return []
    return await organization_service.list_labels(session, user.id)


@router.post(
    "/labels",
    response_model=LabelRead,
    status_code=201,
    summary="Create a label.",
)
async def create_label_endpoint(
    payload: LabelCreate,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> LabelRead:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    return await organization_service.create_label(session, user.id, payload)


@router.patch(
    "/labels/{label_id}",
    response_model=LabelRead,
    summary="Rename / recolor a label.",
)
async def update_label_endpoint(
    label_id: str,
    payload: LabelUpdate,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> LabelRead:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    try:
        return await organization_service.update_label(session, label_id, user.id, payload)
    except organization_service.LabelNotFound as exc:
        raise HTTPException(status_code=404, detail="Label not found") from exc


@router.delete(
    "/labels/{label_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
    summary="Delete a label.",
)
async def delete_label_endpoint(
    label_id: str,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> None:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    try:
        await organization_service.delete_label(session, label_id, user.id)
    except organization_service.LabelNotFound as exc:
        raise HTTPException(status_code=404, detail="Label not found") from exc


# ===== Per-message bindings =====

@router.get(
    "/messages/{message_id}/labels",
    response_model=list[MessageLabelRead],
    summary="List labels attached to a message.",
)
async def get_message_labels_endpoint(
    message_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> list[MessageLabelRead]:
    rows = await organization_service.get_message_labels(session, message_id)
    return [MessageLabelRead(label_id=r.id, name=r.name, color=r.color) for r in rows]


@router.put(
    "/messages/{message_id}/labels",
    response_model=list[LabelRead],
    summary="Replace the labels attached to a message.",
)
async def set_message_labels_endpoint(
    message_id: str,
    payload: MessageLabelUpdate,
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> list[LabelRead]:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    try:
        return await organization_service.set_message_labels(session, message_id, user.id, payload)
    except organization_service.FolderNotFound as exc:
        raise HTTPException(status_code=404, detail="Message not found") from exc


# ===== Trash =====

@router.post(
    "/messages/{message_id}/trash",
    response_model=dict,
    summary="Move a message to the trash (soft delete).",
)
async def trash_message_endpoint(
    message_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> dict:
    try:
        m = await organization_service.trash_message(session, message_id, await _owner(user))
    except organization_service.FolderNotFound as exc:
        raise HTTPException(status_code=404, detail="Message not found") from exc
    return {"id": m.id, "is_trashed": m.is_trashed, "trashed_at": m.trashed_at.isoformat() if m.trashed_at else None}


@router.post(
    "/messages/{message_id}/restore",
    response_model=dict,
    summary="Restore a message from the trash.",
)
async def restore_message_endpoint(
    message_id: str,
    session: AsyncSession = Depends(db_session),
    user: Optional[User] = Depends(current_user_optional),
) -> dict:
    try:
        m = await organization_service.restore_message(session, message_id, await _owner(user))
    except organization_service.FolderNotFound as exc:
        raise HTTPException(status_code=404, detail="Message not found") from exc
    return {"id": m.id, "is_trashed": m.is_trashed, "trashed_at": None}


@router.post(
    "/trash/empty",
    summary="Permanently delete all the caller's trashed messages.",
)
async def empty_trash_endpoint(
    user: User = Depends(current_user_optional),
    session: AsyncSession = Depends(db_session),
) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="需要登录")
    deleted = await organization_service.empty_trash(session, user.id)
    return {"deleted": deleted}
