"""User profile — proxy to Back API."""

import app.back_client as back

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/user/profile")
async def get_user_profile():
    return back.get("/user/profile")


@router.put("/user/profile")
async def update_user_profile(request: Request):
    body = await request.json()
    return back.put("/user/profile", body)


@router.delete("/user/profile")
async def reset_user_profile():
    return back.delete("/user/profile")
