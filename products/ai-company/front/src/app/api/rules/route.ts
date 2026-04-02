const BACK_URL = process.env.BACK_URL || "http://localhost:8001";
import { NextRequest } from "next/server";


// GET /api/rules?type=company
// GET /api/rules?type=department&id=sales
// GET /api/rules?type=departments  (list)
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "company";
  const id = req.nextUrl.searchParams.get("id");

  let endpoint: string;
  if (type === "departments") {
    endpoint = "/rules/departments";
  } else if (type === "department" && id) {
    endpoint = `/rules/department/${id}`;
  } else {
    endpoint = "/rules/company";
  }

  try {
    const res = await fetch(`${BACK_URL}/worker${endpoint}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}

// PUT /api/rules  body: { type, id?, content }
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { type, id, content } = body;

  let endpoint: string;
  if (type === "department" && id) {
    endpoint = `/rules/department/${id}`;
  } else {
    endpoint = "/rules/company";
  }

  try {
    const res = await fetch(`${BACK_URL}/worker${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
