import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/news`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ news: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body._action === "update") {
    try {
      const res = await fetch(`${WORKER_URL}/news/update`, { method: "POST" });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
