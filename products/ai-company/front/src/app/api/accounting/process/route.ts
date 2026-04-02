import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${WORKER_URL}/accounting/process`, {
      method: "POST",
      body: formData,
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
