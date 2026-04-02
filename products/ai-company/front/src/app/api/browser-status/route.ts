const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${BACK_URL}/worker/browser/status`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ active: false });
  }
}
