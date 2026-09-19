import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {AppShell} from "@/components/app-shell";
import {DocumentsWorkspace, type DocumentsCopy} from "@/components/documents-workspace";
import {isLocale} from "@/lib/i18n/routing";

const navKeys = ["home", "documents", "finance", "assistant", "settings"] as const;
const homeKeys = ["eyebrow", "hello", "lead", "capture", "ask", "balance", "month", "documents", "protected", "events", "empty", "stream", "streamHint", "private", "navigation"] as const;
const documentKeys = ["eyebrow", "title", "description", "privateLabel", "chooseFile", "upload", "allowed", "empty", "loading", "uploading", "success", "download", "error", "invalidFile"] as const;

export default async function DocumentsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale: rawLocale} = await params;
  if (!isLocale(rawLocale)) notFound();
  setRequestLocale(rawLocale);
  const [nav, home, documents] = await Promise.all([
    getTranslations("Nav"),
    getTranslations("Home"),
    getTranslations("Documents")
  ]);

  return <AppShell
    locale={rawLocale}
    activeNav="documents"
    pageTitle={documents("title")}
    copy={{
      nav: Object.fromEntries(navKeys.map((key) => [key, nav(key)])) as Record<(typeof navKeys)[number], string>,
      home: Object.fromEntries(homeKeys.map((key) => [key, home(key)]))
    }}
  >
    <DocumentsWorkspace
      locale={rawLocale}
      copy={Object.fromEntries(documentKeys.map((key) => [key, documents(key)])) as DocumentsCopy}
    />
  </AppShell>;
}
