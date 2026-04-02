import { NextRequest } from "next/server";

const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  const q = req.nextUrl.searchParams.get("q") || "";
  const limit = req.nextUrl.searchParams.get("limit") || "100";
  try {
    const res = await fetch(`${BACK_URL}/data/${collection}?q=${q}&limit=${limit}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  const body = await req.json();
  try {
    const res = await fetch(`${BACK_URL}/data/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
