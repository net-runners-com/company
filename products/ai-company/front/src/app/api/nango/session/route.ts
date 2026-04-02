import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function POST(req: NextRequest) {
  // TODO: Supabase Auth token validation
  const body = await req.json();

  try {
    const res = await fetch(`${BACK_URL}/nango/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Back not reachable" }, { status: 502 });
  }
}
