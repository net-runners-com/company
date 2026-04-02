"""Generic data store CRUD — proxy to Back API."""

import app.back_client as back

from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/data/{collection}")
async def data_create(collection: str, request: Request):
    body = await request.json()
    doc_id = body.pop("id", None) or ""
    if doc_id:
        return back.save_data(collection, doc_id, body)
    return back.post(f"/data/{collection}", body)


@router.get("/data/{collection}")
async def data_list(collection: str, q: str = "", limit: int = 100, offset: int = 0):
    return back.get(f"/data/{collection}?q={q}&limit={limit}&offset={offset}")


@router.get("/data/{collection}/{doc_id}")
async def data_get(collection: str, doc_id: str):
    return back.get(f"/data/{collection}/{doc_id}")


@router.put("/data/{collection}/{doc_id}")
async def data_update(collection: str, doc_id: str, request: Request):
    body = await request.json()
    return back.put(f"/data/{collection}/{doc_id}", body)


@router.delete("/data/{collection}/{doc_id}")
async def data_delete(collection: str, doc_id: str):
    return back.delete(f"/data/{collection}/{doc_id}")


@router.get("/data")
async def data_collections():
    return back.get("/data")
