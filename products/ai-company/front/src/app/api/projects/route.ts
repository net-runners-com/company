import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("id");

  // Single project status (polling)
  if (projectId) {
    try {
      const res = await fetch(`${WORKER_URL}/projects/${projectId}/status`, { cache: "no-store" });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // List all
  try {
    const res = await fetch(`${WORKER_URL}/projects`, { cache: "no-store" });
    return Response.json(await res.json());
  } catch {
    return Response.json({ projects: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Cancel step
  if (body._action === "cancel" && body.projectId && body.step) {
    try {
      const res = await fetch(`${WORKER_URL}/projects/${body.projectId}/cancel/${body.step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Execute step (fire-and-forget — worker returns immediately)
  if (body._action === "execute" && body.projectId && body.step) {
    try {
      const res = await fetch(`${WORKER_URL}/projects/${body.projectId}/execute/${body.step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Create project
  try {
    const res = await fetch(`${WORKER_URL}/projects`, {
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
