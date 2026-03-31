import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/user/profile`);
    return Response.json(await res.json());
  } catch {
    return Response.json({}, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${WORKER_URL}/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const res = await fetch(`${WORKER_URL}/user/profile`, { method: "DELETE" });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
