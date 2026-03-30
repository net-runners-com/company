import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/projects`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ projects: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Execute step
  if (body._action === "execute" && body.projectId && body.step) {
    try {
      const res = await fetch(`${WORKER_URL}/projects/${body.projectId}/execute/${body.step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(200000),
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
