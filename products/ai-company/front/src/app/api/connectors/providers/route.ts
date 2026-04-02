const BACK_URL = process.env.BACK_URL || "http://localhost:8001";
import { NextRequest } from "next/server";


export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") || "en";
  try {
    const res = await fetch(`${BACK_URL}/connectors/providers?locale=${locale}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
