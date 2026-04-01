import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/pages/list`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ pages: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 削除
  if (body._action === "delete" && body.slug) {
    try {
      const res = await fetch(`${WORKER_URL}/pages/${body.slug}`, { method: "DELETE" });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // 更新
  if (body._action === "update" && body.slug) {
    try {
      const res = await fetch(`${WORKER_URL}/pages/${body.slug}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // 生成
  try {
    const res = await fetch(`${WORKER_URL}/pages/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
