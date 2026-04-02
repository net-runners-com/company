import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${BACK_URL}/schedules`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ schedules: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body._action === "delete" && body.id) {
    try {
      const res = await fetch(`${BACK_URL}/schedules/${body.id}`, { method: "DELETE" });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
