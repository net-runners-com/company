import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { employeeId, message, _action, threadId } = body;

  if (!employeeId) {
    return Response.json({ error: "employeeId is required" }, { status: 400 });
  }

  // List threads
  if (_action === "threads") {
    try {
      const res = await fetch(`${BACK_URL}/employee/${employeeId}/threads`);
      return Response.json(await res.json());
    } catch {
      return Response.json({ threads: [] }, { status: 200 });
    }
  }

  // Create thread
  if (_action === "create_thread") {
    try {
      const res = await fetch(`${BACK_URL}/employee/${employeeId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: body.title || "" }),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Delete thread
  if (_action === "delete_thread") {
    const tid = threadId;
    if (!tid) return Response.json({ error: "threadId required" }, { status: 400 });
    try {
      const res = await fetch(`${BACK_URL}/employee/${employeeId}/threads/${tid}`, {
        method: "DELETE",
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
      const res = await fetch(`${BACK_URL}/employee/${employeeId}/chat/history?thread_id=${tid}`);
      return Response.json(await res.json());
    } catch {
      return Response.json([], { status: 200 });
    }
  }

  // Register employee on worker
  if (_action === "register") {
    try {
      const res = await fetch(`${BACK_URL}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Back API not reachable" }, { status: 502 });
    }
  }

  // Permission response
  if (_action === "permission") {
    const { action: permAction, patterns } = body;
    try {
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/permission`, {
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
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Start chat run (background agent)
  if (_action === "start_run") {
    try {
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId: threadId || "default" }),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Stream run events (SSE proxy)
  if (_action === "stream_run") {
    const runId = body.runId;
    if (!runId) return Response.json({ error: "runId required" }, { status: 400 });
    try {
      const res = await fetch(
        `${BACK_URL}/worker/employee/${employeeId}/chat/run/${runId}`,
        { signal: AbortSignal.timeout(600000) }
      );
      if (!res.body) return Response.json({ error: "No stream body" }, { status: 502 });
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

  // Stop run
  if (_action === "stop_run") {
    const runId = body.runId;
    if (!runId) return Response.json({ error: "runId required" }, { status: 400 });
    try {
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/chat/run/${runId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Check active run
  if (_action === "check_active") {
    try {
      const tid = threadId || "default";
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/chat/active?thread_id=${tid}`);
      return Response.json(await res.json());
    } catch {
      return Response.json({ active: false }, { status: 200 });
    }
  }

  // Legacy: direct stream (keep for backwards compat, but redirect to new flow)
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // New flow: start run + stream
  try {
    const startRes = await fetch(`${BACK_URL}/worker/employee/${employeeId}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, threadId: threadId || "default" }),
    });
    const startData = await startRes.json();
    if (!startData.runId) {
      return Response.json({ error: startData.error || "Failed to start run" }, { status: 502 });
    }

    // Immediately connect to SSE
    const sseRes = await fetch(
      `${BACK_URL}/worker/employee/${employeeId}/chat/run/${startData.runId}`,
      { signal: AbortSignal.timeout(600000) }
    );
    if (!sseRes.body) {
      return Response.json({ error: "No stream body" }, { status: 502 });
    }

    // Inject runId as first SSE event
    const encoder = new TextEncoder();
    const runIdEvent = encoder.encode(`data: ${JSON.stringify({ type: "run_started", runId: startData.runId })}\n\n`);

    const originalBody = sseRes.body;
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(runIdEvent);
        const reader = originalBody.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
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
