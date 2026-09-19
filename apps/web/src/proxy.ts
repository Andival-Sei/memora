import {clerkMiddleware, createRouteMatcher} from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import {NextResponse} from "next/server";
import {routing} from "@/lib/i18n/routing";

const handleI18n = createMiddleware(routing);
const isPublic = createRouteMatcher(["/:locale/sign-in(.*)", "/:locale/sign-up(.*)", "/api/health"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  return handleI18n(request);
});

export const config = {matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"]};
