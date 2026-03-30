const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/nango/connections`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ connections: [] }, { status: 502 });
  }
}
