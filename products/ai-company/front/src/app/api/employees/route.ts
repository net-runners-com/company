import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${BACK_URL}/employees`);
    return Response.json(await res.json());
  } catch {
    return Response.json({}, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body._action === "delete" && body.id) {
      const res = await fetch(`${BACK_URL}/employees/${body.id}`, { method: "DELETE" });
      return Response.json(await res.json());
    }

    const res = await fetch(`${BACK_URL}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
