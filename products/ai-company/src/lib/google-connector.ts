import { query } from "@/lib/auth";

// コネクタ別スコープ
export const CONNECTOR_SCOPES: Record<string, string> = {
  "google-calendar": "https://www.googleapis.com/auth/calendar",
  "gmail": "https://www.googleapis.com/auth/gmail.modify",
  "google-drive": "https://www.googleapis.com/auth/drive",
};

// 段階的認証URL生成
export function buildAuthUrl(connectorId: string, userId: string): string | null {
  const scope = CONNECTOR_SCOPES[connectorId];
  if (!scope) return null;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", `openid email profile ${scope}`);
  url.searchParams.set("state", JSON.stringify({ connectorId, userId }));

  return url.toString();
}

// code → token 交換 + DB保存
export async function exchangeAndSave(code: string, connectorId: string, userId: string) {
  const scope = CONNECTOR_SCOPES[connectorId];
  if (!scope) throw new Error("Unknown connector");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const tokens = await res.json();

  await query(
    `INSERT INTO google_tokens (user_id, scope, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, scope) DO UPDATE
     SET access_token = $3, refresh_token = COALESCE($4, google_tokens.refresh_token),
         expires_at = $5, updated_at = now()`,
    [userId, scope, tokens.access_token, tokens.refresh_token || null,
     tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null]
  );

  return tokens;
}

// ユーザーのコネクタ接続状態
export async function getStatus(userId: string) {
  const rows = await query(
    "SELECT scope, expires_at, updated_at FROM google_tokens WHERE user_id = $1",
    [userId]
  );

  const status: Record<string, { connected: boolean; expiresAt: string | null }> = {};
  for (const [connectorId, scope] of Object.entries(CONNECTOR_SCOPES)) {
    const token = rows.find((r: { scope: string }) => r.scope === scope);
    status[connectorId] = {
      connected: !!token,
      expiresAt: token?.expires_at || null,
    };
  }
  return status;
}

// トークン取得（Worker に渡す用）
export async function getToken(userId: string, connectorId: string) {
  const scope = CONNECTOR_SCOPES[connectorId];
  if (!scope) return null;

  const rows = await query(
    "SELECT access_token, refresh_token, expires_at FROM google_tokens WHERE user_id = $1 AND scope = $2",
    [userId, scope]
  );
  return rows[0] || null;
}
