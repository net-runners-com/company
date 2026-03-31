import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { employeeId, message, _action, threadId } = body;

  if (!employeeId) {
    return Response.json({ error: "employeeId is required" }, { status: 400 });
  }

  // List threads
  if (_action === "threads") {
    try {
      const res = await fetch(`${WORKER_URL}/employee/${employeeId}/threads`);
      return Response.json(await res.json());
    } catch {
      return Response.json({ threads: [] }, { status: 200 });
    }
  }

  // Create thread
  if (_action === "create_thread") {
    try {
      const res = await fetch(`${WORKER_URL}/employee/${employeeId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: body.title || "" }),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Fetch chat history
  if (_action === "history") {
    try {
      const tid = threadId || "default";
      const res = await fetch(`${WORKER_URL}/employee/${employeeId}/chat/history?thread_id=${tid}`);
      return Response.json(await res.json());
    } catch {
      return Response.json([], { status: 200 });
    }
  }

  // Register employee on worker (ensure it exists)
  if (_action === "register") {
    try {
      const res = await fetch(`${WORKER_URL}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Permission response
  if (_action === "permission") {
    const { action: permAction, patterns } = body;
    try {
      const res = await fetch(`${WORKER_URL}/employee/${employeeId}/permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: permAction, patterns }),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Reset session
  if (_action === "reset") {
    try {
      const res = await fetch(`${WORKER_URL}/employee/${employeeId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Stream chat
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${WORKER_URL}/employee/${employeeId}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, threadId: threadId || "default" }),
      signal: AbortSignal.timeout(300000),
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
