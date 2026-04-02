"""HTTP client for calling the shared Back API (PostgreSQL)."""

import json
import os
import urllib.request
import urllib.error

BACK_URL = os.environ.get("BACK_URL", "http://back:8001")


def _request(method: str, path: str, data: dict | None = None, timeout: int = 10) -> dict:
    url = f"{BACK_URL}{path}"
    body = json.dumps(data, ensure_ascii=False).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = {"error": str(e)}
        return err_body
    except Exception as e:
        print(f"[back_client] {method} {path} error: {e}")
        return {"error": str(e)}


def get(path: str, timeout: int = 10) -> dict:
    return _request("GET", path, timeout=timeout)


def post(path: str, data: dict, timeout: int = 10) -> dict:
    return _request("POST", path, data, timeout)


def put(path: str, data: dict, timeout: int = 10) -> dict:
    return _request("PUT", path, data, timeout)


def delete(path: str, timeout: int = 10) -> dict:
    return _request("DELETE", path, timeout=timeout)


# ─── Convenience helpers ───

def load_employees() -> dict:
    return get("/employees")


def get_employee(emp_id: str) -> dict | None:
    result = get(f"/employees/{emp_id}")
    if "error" in result:
        return None
    return result


def save_employee(emp_id: str, emp: dict):
    post("/employees", {**emp, "id": emp_id})


def create_thread(emp_id: str, title: str = "") -> dict:
    return post(f"/employee/{emp_id}/threads", {"title": title})


def append_chat_log(emp_id: str, role: str, content: str, thread_id: str = "default"):
    post(f"/employee/{emp_id}/chat/log", {
        "role": role, "content": content, "threadId": thread_id,
    })


def read_chat_log(emp_id: str, thread_id: str = "default") -> list:
    result = get(f"/employee/{emp_id}/chat/history?thread_id={thread_id}")
    return result if isinstance(result, list) else []


def save_data(collection: str, doc_id: str, data: dict):
    post(f"/data/{collection}", {"id": doc_id, **data})


def get_data(collection: str, doc_id: str) -> dict | None:
    result = get(f"/data/{collection}/{doc_id}")
    if "error" in result:
        return None
    return result


def list_data(collection: str, limit: int = 100) -> list:
    result = get(f"/data/{collection}?limit={limit}")
    return result.get("entries", [])


def delete_data(collection: str, doc_id: str):
    delete(f"/data/{collection}/{doc_id}")
