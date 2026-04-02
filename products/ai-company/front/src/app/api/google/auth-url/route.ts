import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google-connector";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectorId = req.nextUrl.searchParams.get("connector");
  if (!connectorId) {
    return Response.json({ error: "connector param required" }, { status: 400 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return Response.json({ error: "No user id" }, { status: 400 });
  }

  const url = buildAuthUrl(connectorId, userId);
  if (!url) {
    return Response.json({ error: "Unknown connector" }, { status: 400 });
  }

  return Response.json({ url });
}
