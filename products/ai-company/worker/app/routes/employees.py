"""Employee endpoints — proxy to back API."""

import app.back_client as back

from fastapi import APIRouter

router = APIRouter()


@router.post("/employees")
async def upsert_employee(payload: dict):
    return back.post("/employees", payload)


@router.get("/employees")
async def list_employees():
    return back.load_employees()


@router.get("/employees/{emp_id}")
async def get_employee_info(emp_id: str):
    return back.get(f"/employees/{emp_id}")


@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str):
    return back.delete(f"/employees/{emp_id}")
