import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStatus } from "@/lib/google-connector";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) return Response.json({});

  const status = await getStatus(userId);
  return Response.json(status);
}
