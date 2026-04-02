import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("_action");

  // Google OAuth auth URL
  if (action === "google-auth") {
    const provider = searchParams.get("provider") || "";
    try {
      const res = await fetch(`${BACK_URL}/oauth/google/auth-url?provider=${encodeURIComponent(provider)}`);
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Google OAuth status
  if (action === "google-status") {
    try {
      const res = await fetch(`${BACK_URL}/oauth/google/status`);
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  try {
    const res = await fetch(`${BACK_URL}/connectors`);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { _action, connectorId, ...params } = body;

  // Route to specific actions
  if (_action === "start" && connectorId) {
    try {
      const res = await fetch(`${BACK_URL}/worker/connectors/${connectorId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  if (_action === "verify" && connectorId) {
    try {
      const res = await fetch(`${BACK_URL}/worker/connectors/${connectorId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  if (_action === "stop" && connectorId) {
    try {
      const res = await fetch(`${BACK_URL}/worker/connectors/${connectorId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  if (_action === "delete" && connectorId) {
    try {
      const res = await fetch(`${BACK_URL}/connectors/${connectorId}`, {
        method: "DELETE",
      });
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Default: create/update connector
  try {
    const res = await fetch(`${BACK_URL}/connectors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
