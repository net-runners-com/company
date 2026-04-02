const BACK_URL = process.env.BACK_URL || "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${BACK_URL}/nango/connections`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ connections: [] }, { status: 502 });
  }
}
