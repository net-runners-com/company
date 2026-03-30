import { NextRequest } from "next/server";
import { CONNECTOR_SCOPES, exchangeAndSave } from "@/lib/google-connector";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");

  if (!code || !stateRaw) {
    return new Response("Missing code or state", { status: 400 });
  }

  let state: { connectorId: string; userId: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return new Response("Invalid state", { status: 400 });
  }

  const { connectorId, userId } = state;
  if (!CONNECTOR_SCOPES[connectorId]) {
    return new Response("Unknown connector", { status: 400 });
  }

  try {
    await exchangeAndSave(code, connectorId, userId);
  } catch (e) {
    console.error("[google/callback]", e);
    return new Response("Token exchange failed", { status: 500 });
  }

  return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?connected=${connectorId}`);
}
