import {ClerkProvider} from "@clerk/nextjs";
import type {Metadata} from "next";
import {NextIntlClientProvider} from "next-intl";
import {getMessages, getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {ThemeProvider} from "@/components/theme-provider";
import {isLocale, locales} from "@/lib/i18n/routing";
import "../globals.css";

export function generateStaticParams() { return locales.map((locale) => ({locale})); }
export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({locale, namespace: "Meta"});
  return {title: t("title"), description: t("description")};
}

export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return <html lang={locale} suppressHydrationWarning><body><ClerkProvider><NextIntlClientProvider messages={messages}><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider></NextIntlClientProvider></ClerkProvider></body></html>;
}
