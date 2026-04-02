const BACK_URL = process.env.BACK_URL || "http://localhost:8001";
import { NextRequest } from "next/server";


export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${BACK_URL}/worker/directive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000), // 5 min
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
