import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
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
