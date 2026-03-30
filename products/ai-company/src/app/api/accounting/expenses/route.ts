import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") || "";
  try {
    const res = await fetch(`${WORKER_URL}/accounting/expenses?month=${month}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
