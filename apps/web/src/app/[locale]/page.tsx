import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {AppShell} from "@/components/app-shell";
import {DocumentTypeCatalog} from "@/components/document-type-catalog";
import {isLocale} from "@/lib/i18n/routing";
import {listDocumentTypeDefinitions} from "@memora/domain";

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [nav, home] = await Promise.all([getTranslations("Nav"), getTranslations("Home")]);
  const navKeys = ["home", "documents", "finance", "assistant", "settings"] as const;
  const homeKeys = ["eyebrow", "hello", "lead", "capture", "ask", "balance", "month", "documents", "protected", "events", "empty", "stream", "streamHint", "private", "navigation"] as const;
  return <AppShell
    locale={locale}
    copy={{nav: Object.fromEntries(navKeys.map((key) => [key, nav(key)])) as Record<(typeof navKeys)[number], string>, home: Object.fromEntries(homeKeys.map((key) => [key, home(key)]))}}
    homeExtra={<DocumentTypeCatalog definitions={listDocumentTypeDefinitions()} locale={locale} copy={{
      title: home("documentTypesTitle"),
      hint: home("documentTypesHint"),
      recordsLabel: home("recordsLabel"),
      fieldCount: home("fieldCount"),
      needsReview: home("needsReview"),
      unavailable: home("documentsUnavailable")
    }} />}
  />;
}
