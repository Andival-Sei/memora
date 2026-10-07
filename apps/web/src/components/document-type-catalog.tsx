"use client";

import {documentRecordListResponseSchema, type DocumentTypeDefinition} from "@memora/contracts";
import type {Locale} from "@/lib/i18n/routing";
import {useEffect, useState} from "react";

const glyphs: Record<DocumentTypeDefinition["id"], string> = {
  "ru-passport": "▤",
  "international-passport": "✈",
  "drivers-license": "⌁",
  "tax-or-insurance": "№",
  "birth-certificate": "◷",
  "medical-policy": "✚",
  contract: "▧",
  other: "＋"
};

export function DocumentTypeCatalog({
  definitions,
  locale,
  copy
}: {
  definitions: DocumentTypeDefinition[];
  locale: Locale;
  copy: {title: string; hint: string; recordsLabel: string; fieldCount: string; needsReview: string; unavailable: string};
}) {
  const [counts, setCounts] = useState<Partial<Record<DocumentTypeDefinition["id"], number>>>({});
  const [reviewCounts, setReviewCounts] = useState<Partial<Record<DocumentTypeDefinition["id"], number>>>({});
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/document-records", {cache: "no-store", signal: controller.signal})
      .then(async (response) => {
        const payload = documentRecordListResponseSchema.safeParse(await response.json().catch(() => null));
        if (!response.ok || !payload.success) throw new Error("document-list-unavailable");
        const next: Partial<Record<DocumentTypeDefinition["id"], number>> = {};
        const nextReview: Partial<Record<DocumentTypeDefinition["id"], number>> = {};
        for (const record of payload.data.records) {
          next[record.documentType] = (next[record.documentType] ?? 0) + 1;
          if (record.status === "needs_review") nextReview[record.documentType] = (nextReview[record.documentType] ?? 0) + 1;
        }
        setCounts(next);
        setReviewCounts(nextReview);
        setRecordsLoaded(true);
      })
      .catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
    return () => controller.abort();
  }, []);

  return <section className="home-document-catalog" aria-labelledby="home-document-catalog-title">
    <div className="home-document-catalog__intro">
      <div><p className="eyebrow">Memora</p><h2 id="home-document-catalog-title">{copy.title}</h2></div>
      <p>{copy.hint}</p>
    </div>
    {unavailable && <p className="document-catalog-unavailable" role="status">{copy.unavailable}</p>}
    <ul className="document-type-grid document-type-grid--home">
      {definitions.map((definition, index) => {
        const count = counts[definition.id] ?? 0;
        const countLabel = recordsLoaded ? String(count) : "—";
        return <li key={definition.id} style={{"--card-index": index} as React.CSSProperties}>
          <a className="document-type-card" href={`/${locale}/documents?type=${encodeURIComponent(definition.id)}`}>
            <span className="document-type-card__glyph" aria-hidden="true">{glyphs[definition.id]}</span>
            <span className="document-type-card__body"><strong>{definition.label[locale]}</strong><small>{definition.fields.length} {copy.fieldCount}{(reviewCounts[definition.id] ?? 0) > 0 ? ` · ${reviewCounts[definition.id]} ${copy.needsReview}` : ""}</small></span>
            <span className="document-type-card__count" aria-label={`${countLabel} ${copy.recordsLabel}`}>{countLabel}</span>
            <span className="document-type-card__arrow" aria-hidden="true">↗</span>
          </a>
        </li>;
      })}
    </ul>
  </section>;
}
