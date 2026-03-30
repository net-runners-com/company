export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    // (app) 配下の全ページを保護
    "/home/:path*",
    "/secretary/:path*",
    "/progress/:path*",
    "/employees/:path*",
    "/employee/:path*",
    "/organization/:path*",
    "/dashboard/:path*",
    "/tasks/:path*",
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
  ],
};
