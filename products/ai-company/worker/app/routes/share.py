"""Public share pages — proxy to Back API."""

import app.back_client as back

from fastapi import APIRouter

router = APIRouter()


@router.get("/share/{page_id}")
async def get_shared_page(page_id: str):
    return back.get(f"/share/{page_id}")


@router.get("/share/{page_id}/data/{collection}")
async def get_shared_data(page_id: str, collection: str):
    return back.get(f"/share/{page_id}/data/{collection}")
