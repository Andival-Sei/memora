import {defaultLocale, isLocale} from "@/lib/i18n/routing";

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/api/health") return true;

  const [, locale, segment] = pathname.split("/");
  return isLocale(locale ?? "") && (segment === "sign-in" || segment === "sign-up");
}

export function isSameOriginRequest(request: Pick<Request, "url" | "headers">): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function getSignInPath(pathname: string): string {
  const [, locale] = pathname.split("/");
  return `/${isLocale(locale ?? "") ? locale : defaultLocale}/sign-in`;
}
