const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/browser/status`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ active: false });
  }
}
