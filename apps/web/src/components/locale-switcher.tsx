import Link from "next/link";
import type {Locale} from "@/lib/i18n/routing";

export function LocaleSwitcher({locale}: {locale: Locale}) {
  const nextLocale = locale === "ru" ? "en" : "ru";
  return <Link className="locale-switch" href={`/${nextLocale}`}>{nextLocale.toUpperCase()}</Link>;
}
