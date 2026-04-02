import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${BACK_URL}/user/profile`);
    return Response.json(await res.json());
  } catch {
    return Response.json({}, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${BACK_URL}/user/profile`, {
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
    const res = await fetch(`${BACK_URL}/user/profile`, { method: "DELETE" });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
