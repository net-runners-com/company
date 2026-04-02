const BACK_URL = process.env.BACK_URL || "http://localhost:8001";
import { NextRequest } from "next/server";


export async function POST(req: NextRequest) {
  const { message } = await req.json();

  if (!message || typeof message !== "string") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACK_URL}/worker/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(130000), // slightly longer than worker's 120s
    });

    const data = await res.json();

    if (data.error) {
      return Response.json({ error: data.error }, { status: 500 });
    }

    return Response.json({ response: data.response });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Worker connection failed: ${errorMessage}` }, { status: 502 });
  }
}
