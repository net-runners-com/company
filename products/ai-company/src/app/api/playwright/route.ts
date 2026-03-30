import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, ...params } = body;

  // Streaming chat — proxy SSE from worker
  if (action === "chat-stream") {
    try {
      const res = await fetch(`${WORKER_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(130000),
      });
      if (!res.body) {
        return Response.json({ error: "No stream body" }, { status: 502 });
      }
      return new Response(res.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return Response.json({ error: msg }, { status: 502 });
    }
  }

  const endpoints: Record<string, string> = {
    navigate: "/playwright/navigate",
    close: "/playwright/close",
    run: "/playwright/run",
    chat: "/chat",
  };

  const endpoint = endpoints[action];
  if (!endpoint) {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const res = await fetch(`${WORKER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(130000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 502 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/playwright/status`);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
