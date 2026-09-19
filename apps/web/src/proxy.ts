import {clerkMiddleware} from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import {NextResponse} from "next/server";
import {getSignInPath, isPublicPath} from "@/lib/auth/route-policy";
import {routing} from "@/lib/i18n/routing";

const handleI18n = createMiddleware(routing);

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  if (!isPublicPath(pathname)) {
    const {isAuthenticated} = await auth();
    if (!isAuthenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401, headers: {"cache-control": "no-store"}});
      }
      return NextResponse.redirect(new URL(getSignInPath(pathname), request.url));
    }
  }
  if (pathname.startsWith("/api/")) return NextResponse.next();
  return handleI18n(request);
});

export const config = {matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"]};
