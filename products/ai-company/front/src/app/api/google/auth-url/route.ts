import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") || "";
  try {
    const res = await fetch(`${BACK_URL}/oauth/google/auth-url?provider=${encodeURIComponent(provider)}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Back not reachable" }, { status: 502 });
  }
}
