const BACK_URL = process.env.BACK_URL || "http://localhost:8001";
import { NextRequest } from "next/server";


export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") || "";
  try {
    const res = await fetch(`${BACK_URL}/calendar/events?month=${month}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ events: [] }, { status: 502 });
  }
}
