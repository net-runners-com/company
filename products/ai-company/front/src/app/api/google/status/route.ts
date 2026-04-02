const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${BACK_URL}/oauth/google/status`);
    return Response.json(await res.json());
  } catch {
    return Response.json({}, { status: 502 });
  }
}
