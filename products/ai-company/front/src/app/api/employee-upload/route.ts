import { NextRequest } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const employeeId = formData.get("employeeId") as string;

  if (!employeeId) {
    return Response.json({ error: "employeeId required" }, { status: 400 });
  }

  // Forward multipart to worker
  const workerFormData = new FormData();
  const file = formData.get("file") as File;
  if (!file) {
    return Response.json({ error: "No file" }, { status: 400 });
  }
  workerFormData.append("file", file);

  try {
    const res = await fetch(`${WORKER_URL}/employee/${employeeId}/files/upload`, {
      method: "POST",
      body: workerFormData,
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
