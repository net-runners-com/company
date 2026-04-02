import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  // Supabase tokenをcookieから取得
  const accessToken = request.cookies.get("sb-access-token")?.value
    || request.cookies.get(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`)?.value;

  // トークンがなければログインへ
  if (!accessToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/secretary/:path*",
    "/progress/:path*",
    "/pages/:path*",
    "/employees/:path*",
    "/employee/:path*",
    "/dashboard/:path*",
    "/tasks/:path*",
    "/schedules/:path*",
    "/schedule/:path*",
    "/projects/:path*",
    "/sales/:path*",
    "/revenue/:path*",
    "/documents/:path*",
    "/finance/:path*",
    "/sns/:path*",
    "/activity/:path*",
    "/automation/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/products/:path*",
    "/prompts/:path*",
  ],
};
