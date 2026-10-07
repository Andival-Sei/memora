"use client";

import {upload} from "@vercel/blob/client";
import {
  documentListResponseSchema,
  documentRecordCreateResponseSchema,
  documentRecordListResponseSchema,
  documentRecordUploadTicketResponseSchema,
  documentRecordWorkspaceResponseSchema,
  type PublicDocument as GenericDocument,
  type DocumentAssetContentType,
  type DocumentRecordType,
  type DocumentTypeDefinition,
  type PublicDocumentRecord,
  type PublicDocumentRecordWorkspace
} from "@memora/contracts";
import type {Locale} from "@/lib/i18n/routing";
import {useCallback, useEffect, useMemo, useState} from "react";

export type DocumentsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  privateLabel: string;
  chooseFile: string;
  upload: string;
  allowed: string;
  empty: string;
  loading: string;
  uploading: string;
  success: string;
  download: string;
  error: string;
  invalidFile: string;
  selectType: string;
  typeHint: string;
  recordsLabel: string;
  fieldCount: string;
  fieldsTitle: string;
  fieldsNotice: string;
  pagesTitle: string;
  choosePages: string;
  pageLabel: string;
  removePage: string;
  movePageUp: string;
  movePageDown: string;
  savePages: string;
  savingPages: string;
  openRecord: string;
  noRecords: string;
  statusEmpty: string;
  statusProcessing: string;
  statusNeedsReview: string;
  statusConfirmed: string;
  statusFailed: string;
  statusExpired: string;
  listUnavailable: string;
  pageLimit: string;
  fileLimit: string;
  loadingRecord: string;
  recognizedLater: string;
  previousUploadsTitle: string;
  previousUploadsHint: string;
  untypedDocument: string;
  previousUploadsUnavailable: string;
  uploadUnavailable: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf"
};

function getFileContentType(file: File): DocumentAssetContentType | null {
  if (file.type) return file.type in MIME_TO_EXTENSION ? file.type as DocumentAssetContentType : null;
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "pdf") return "application/pdf";
  return null;
}

type Status = "loading" | "idle" | "loading-record" | "uploading" | "success" | "error";

function formatBytes(bytes: number, locale: Locale): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (const candidate of units) {
    unit = candidate;
    if (value < 1024 || candidate === units.at(-1)) break;
    value /= 1024;
  }
  return `${new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(value)} ${unit}`;
}

function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(new Date(date));
}

function statusLabel(status: PublicDocumentRecord["status"], copy: DocumentsCopy): string {
  const labels = {
    empty: copy.statusEmpty,
    processing: copy.statusProcessing,
    needs_review: copy.statusNeedsReview,
    confirmed: copy.statusConfirmed,
    failed: copy.statusFailed,
    expired: copy.statusExpired
  };
  return labels[status];
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function DocumentsWorkspace({
  copy,
  locale,
  definitions,
  initialType = null
}: {
  copy: DocumentsCopy;
  locale: Locale;
  definitions: DocumentTypeDefinition[];
  initialType?: DocumentRecordType | null;
}) {
  const [records, setRecords] = useState<PublicDocumentRecord[]>([]);
  const [previousUploads, setPreviousUploads] = useState<GenericDocument[]>([]);
  const [selectedType, setSelectedType] = useState<DocumentRecordType | null>(initialType);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<PublicDocumentRecordWorkspace | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Array<string | null>>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordsLoadError, setRecordsLoadError] = useState(false);
  const [previousUploadsLoadError, setPreviousUploadsLoadError] = useState(false);
  const [previousUploadsResolved, setPreviousUploadsResolved] = useState(false);

  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.id === selectedType) ?? null,
    [definitions, selectedType]
  );

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/document-records", {cache: "no-store", signal: signal ?? null});
      const payload = documentRecordListResponseSchema.safeParse(await readJson(response));
      if (!response.ok || !payload.success) throw new Error("document-record-list-failed");
      setRecords(payload.data.records);
      setRecordsLoadError(false);
      setErrorMessage(null);
      setStatus((current) => current === "loading" ? "idle" : current);
    } catch {
      if (!signal?.aborted) {
        setRecordsLoadError(true);
        setErrorMessage(copy.listUnavailable);
        setStatus((current) => current === "loading" ? "idle" : current);
      }
    }
  }, [copy.listUnavailable]);

  const loadPreviousUploads = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/documents", {cache: "no-store", signal: signal ?? null});
      const payload = documentListResponseSchema.safeParse(await readJson(response));
      if (!response.ok || !payload.success) throw new Error("previous-upload-list-failed");
      setPreviousUploads(payload.data.documents);
      setPreviousUploadsLoadError(false);
      setPreviousUploadsResolved(true);
    } catch {
      if (!signal?.aborted) {
        setPreviousUploadsLoadError(true);
        setPreviousUploadsResolved(true);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadRecords(controller.signal);
    void loadPreviousUploads(controller.signal);
    return () => controller.abort();
  }, [loadRecords, loadPreviousUploads]);

  useEffect(() => {
    const urls = selectedFiles.map((file) => {
      if (!file.type.startsWith("image/") || typeof URL.createObjectURL !== "function") return null;
      try {
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    });
    setPreviewUrls(urls);
    return () => urls.forEach((url) => { if (url) URL.revokeObjectURL(url); });
  }, [selectedFiles]);

  const openRecord = async (record: PublicDocumentRecord) => {
    setSelectedType(record.documentType);
    setActiveRecordId(record.id);
    setSelectedFiles([]);
    setStatus("loading-record");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/document-records/${encodeURIComponent(record.id)}`, {cache: "no-store"});
      const raw = await readJson(response);
      const parsed = documentRecordWorkspaceResponseSchema.safeParse(raw);
      if (!response.ok || !parsed.success) throw new Error("record-load-failed");
      setWorkspace(parsed.data.workspace);
      setStatus("idle");
    } catch {
      setErrorMessage(copy.error);
      setStatus("error");
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files || !selectedDefinition) return;
    const additions = Array.from(files);
    const total = selectedFiles.length + (workspace?.assetCount ?? 0) + additions.length;
    if (total > MAX_FILES) {
      setErrorMessage(copy.pageLimit);
      setStatus("error");
      return;
    }
    if (additions.some((file) => file.size <= 0 || file.size > MAX_BYTES)) {
      setErrorMessage(copy.fileLimit);
      setStatus("error");
      return;
    }
    const valid = additions.every((file) => {
      const contentType = getFileContentType(file);
      return contentType !== null && selectedDefinition.acceptedContentTypes.includes(contentType);
    });
    if (!valid) {
      setErrorMessage(copy.invalidFile);
      setStatus("error");
      return;
    }
    setSelectedFiles((current) => [...current, ...additions]);
    setErrorMessage(null);
    setStatus("idle");
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setSelectedFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moving] = next.splice(index, 1);
      if (!moving) return current;
      next.splice(target, 0, moving);
      return next;
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (recordsLoadError) {
      setErrorMessage(copy.uploadUnavailable);
      setStatus("error");
      return;
    }
    if (!selectedDefinition || selectedFiles.length === 0) {
      setErrorMessage(copy.invalidFile);
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setUploadProgress(0);
    setErrorMessage(null);
    try {
      let recordId = activeRecordId;
      if (!recordId) {
        const createResponse = await fetch("/api/document-records", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({documentType: selectedDefinition.id}),
          cache: "no-store"
        });
        const created = documentRecordCreateResponseSchema.safeParse(await readJson(createResponse));
        if (!createResponse.ok || !created.success) throw new Error("record-create-failed");
        recordId = created.data.record.id;
        setActiveRecordId(recordId);
      }

      let latestWorkspace = workspace;
      for (const [index, file] of selectedFiles.entries()) {
        const contentType = getFileContentType(file);
        if (!contentType) throw new Error("invalid-file-type");
        const ticketResponse = await fetch(`/api/document-records/${encodeURIComponent(recordId)}/upload-ticket`, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({contentType}),
          cache: "no-store"
        });
        const ticketPayload = documentRecordUploadTicketResponseSchema.safeParse(await readJson(ticketResponse));
        if (!ticketResponse.ok || !ticketPayload.success) throw new Error("upload-ticket-failed");

        await upload(ticketPayload.data.ticket.pathname, file, {
          access: "private",
          handleUploadUrl: `/api/document-records/${encodeURIComponent(recordId)}/upload`,
          clientPayload: JSON.stringify({contentType}),
          onUploadProgress: ({percentage}) => setUploadProgress(Math.floor(((index + percentage / 100) / selectedFiles.length) * 100))
        });

        const finalizeResponse = await fetch(`/api/document-records/${encodeURIComponent(recordId)}/assets`, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({pathname: ticketPayload.data.ticket.pathname, contentType}),
          cache: "no-store"
        });
        const finalized = documentRecordWorkspaceResponseSchema.safeParse(await readJson(finalizeResponse));
        if (!finalizeResponse.ok || !finalized.success) throw new Error("asset-finalize-failed");
        latestWorkspace = finalized.data.workspace;
        setWorkspace(latestWorkspace);
        setUploadProgress(Math.floor(((index + 1) / selectedFiles.length) * 100));
      }

      if (latestWorkspace) {
        setWorkspace(latestWorkspace);
        setRecords((current) => [latestWorkspace, ...current.filter((record) => record.id !== latestWorkspace?.id)]);
      }
      setSelectedFiles([]);
      setUploadProgress(100);
      setStatus("success");
      void loadRecords();
    } catch {
      setStatus("error");
      setErrorMessage(copy.error);
    }
  };

  const totalSelectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
  const accepted = selectedDefinition?.acceptedContentTypes.join(",") ?? "";
  const typeLabel = (documentType: DocumentRecordType) => {
    const definition = definitions.find((item) => item.id === documentType);
    return definition?.label[locale] ?? documentType;
  };

  return <div className="documents-page">
    <header className="documents-page__intro">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="documents-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <span className="privacy"><i />{copy.privateLabel}</span>
    </header>

    {!selectedDefinition && <section className="document-type-section" aria-labelledby="document-type-title">
      <div className="documents-list__heading"><h3 id="document-type-title">{copy.selectType}</h3><span>{definitions.length}</span></div>
      <p className="document-type-hint">{copy.typeHint}</p>
      <ul className="document-type-grid">
        {definitions.map((definition, index) => {
          const count = records.filter((record) => record.documentType === definition.id).length;
          return <li key={definition.id} style={{"--card-index": index} as React.CSSProperties}>
            <a className="document-type-card" href={`/${locale}/documents?type=${encodeURIComponent(definition.id)}`}>
              <span className="document-type-card__glyph" aria-hidden="true">{["▤", "✈", "⌁", "№", "◷", "✚", "▧", "＋"][index]}</span>
              <span className="document-type-card__body"><strong>{definition.label[locale]}</strong><small>{definition.fields.length} {copy.fieldCount}</small></span>
              <span className="document-type-card__count" aria-label={`${count} ${copy.recordsLabel}`}>{count}</span>
              <span className="document-type-card__arrow" aria-hidden="true">↗</span>
            </a>
          </li>;
        })}
      </ul>
      {records.length === 0 && previousUploads.length === 0 && status === "idle" && previousUploadsResolved && !recordsLoadError && !previousUploadsLoadError && <p className="documents-list__empty">{copy.empty}</p>}
      {records.length > 0 && <section className="documents-list" aria-labelledby="saved-records-title">
        <div className="documents-list__heading"><h3 id="saved-records-title">{copy.title}</h3><span>{records.length}</span></div>
        <ul>
          {records.map((record) => <li className="document-row" key={record.id}>
            <span className="document-row__icon" aria-hidden="true">{record.assetCount}</span>
            <span className="document-row__meta"><strong>{record.title || typeLabel(record.documentType)}</strong><small>{statusLabel(record.status, copy)} · {formatDate(record.updatedAt, locale)}</small></span>
            <button className="button button--small" type="button" onClick={() => { void openRecord(record); }}>{copy.openRecord}</button>
          </li>)}
        </ul>
      </section>}
      {(previousUploads.length > 0 || previousUploadsLoadError) && <section className="documents-list" aria-labelledby="previous-uploads-title">
        <div className="documents-list__heading"><h3 id="previous-uploads-title">{copy.previousUploadsTitle}</h3><span>{previousUploads.length}</span></div>
        <p className="document-type-hint">{copy.previousUploadsHint}</p>
        {previousUploadsLoadError
          ? <p role="status">{copy.previousUploadsUnavailable}</p>
          : <ul>
            {previousUploads.map((document) => <li className="document-row" key={document.id}>
              <span className="document-row__icon" aria-hidden="true">PDF</span>
              <span className="document-row__meta"><strong>{document.filename}</strong><small>{copy.untypedDocument} · {formatBytes(document.sizeBytes, locale)} · {formatDate(document.createdAt, locale)}</small></span>
              <a className="button button--small" aria-label={`${copy.download}: ${document.filename}`} href={`/api/documents/${encodeURIComponent(document.id)}/download`}>{copy.download}</a>
            </li>)}
          </ul>}
      </section>}
    </section>}

    {selectedDefinition && <section className="record-intake" aria-labelledby="record-type-title">
      <div className="record-intake__heading">
        <a className="button button--small" href={`/${locale}/documents`}>← {copy.selectType}</a>
        <div><p className="eyebrow">{copy.eyebrow}</p><h3 id="record-type-title">{selectedDefinition.label[locale]}</h3></div>
      </div>

      <section className="record-fields" aria-labelledby="record-fields-title">
        <div className="documents-list__heading"><h4 id="record-fields-title">{copy.fieldsTitle}</h4><span>v{selectedDefinition.schemaVersion}</span></div>
        <p className="record-fields__notice">{copy.fieldsNotice} {copy.recognizedLater}</p>
        <div className="record-fields__grid">
          {selectedDefinition.fields.map((field) => <label className="record-field" key={field.key}>
            <span>{field.label[locale]}{field.required ? <i aria-label="required"> *</i> : null}</span>
            <input type={field.dataType === "date" ? "date" : "text"} disabled placeholder="—" aria-label={field.label[locale]} />
          </label>)}
        </div>
      </section>
      {recordsLoadError && <p className="record-fields__notice" role="status">{copy.uploadUnavailable}</p>}

      <form className="upload-card" aria-busy={status === "uploading"} onSubmit={(event) => { void onSubmit(event); }}>
        <div className="documents-list__heading upload-card__heading"><h4>{copy.pagesTitle}</h4><span>{selectedFiles.length + (workspace?.assetCount ?? 0)}/{MAX_FILES}</span></div>
        <label className="upload-dropzone" htmlFor="document-pages">
          <span className="upload-dropzone__icon" aria-hidden="true">↥</span>
          <span className="upload-dropzone__title">{copy.choosePages}</span>
          <span className="upload-dropzone__hint">{copy.allowed}</span>
          <input
            id="document-pages"
            name="pages"
            type="file"
            aria-label={copy.choosePages}
            accept={accepted}
            multiple
            disabled={status === "loading" || status === "loading-record" || status === "uploading" || recordsLoadError || (workspace?.assetCount ?? 0) >= MAX_FILES}
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>

        {(selectedFiles.length > 0 || (workspace?.assets.length ?? 0) > 0) && <ol className="document-pages">
          {workspace?.assets.map((asset) => <li className="document-page" key={`saved-${asset.id}`}>
            {asset.contentType.startsWith("image/")
              ? <img className="document-page__preview" src={`/api/document-records/${encodeURIComponent(workspace.id)}/assets/${encodeURIComponent(asset.id)}`} alt={`${copy.pageLabel} ${asset.pageIndex + 1}`} loading="lazy" />
              : <span className="document-page__preview document-page__preview--pdf" aria-hidden="true">PDF</span>}
            <span className="document-page__meta"><strong>{copy.pageLabel} {asset.pageIndex + 1}</strong><small>{formatBytes(asset.sizeBytes, locale)}</small></span>
          </li>)}
          {selectedFiles.map((file, index) => <li className="document-page document-page--pending" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
            {previewUrls[index]
              ? <img className="document-page__preview" src={previewUrls[index] ?? undefined} alt={file.name} />
              : <span className="document-page__preview document-page__preview--pdf" aria-hidden="true">PDF</span>}
            <span className="document-page__meta"><strong>{copy.pageLabel} {(workspace?.assetCount ?? 0) + index + 1}</strong><small>{file.name} · {formatBytes(file.size, locale)}</small></span>
            <div className="document-page__actions">
              <button type="button" className="icon-button" aria-label={copy.movePageUp} disabled={index === 0 || status === "uploading"} onClick={() => movePage(index, -1)}>↑</button>
              <button type="button" className="icon-button" aria-label={copy.movePageDown} disabled={index === selectedFiles.length - 1 || status === "uploading"} onClick={() => movePage(index, 1)}>↓</button>
              <button type="button" className="icon-button icon-button--danger" aria-label={copy.removePage} disabled={status === "uploading"} onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
            </div>
          </li>)}
        </ol>}

        <div className="upload-card__footer">
          <span className="upload-card__file">{selectedFiles.length ? `${selectedFiles.length} · ${formatBytes(totalSelectedBytes, locale)}` : copy.allowed}</span>
          <button className="button button--primary" type="submit" disabled={status === "loading" || status === "loading-record" || status === "uploading" || recordsLoadError || selectedFiles.length === 0}>
            {status === "uploading" ? copy.savingPages : copy.savePages}
          </button>
        </div>
        {status === "uploading" && <progress className="upload-progress" max={100} value={uploadProgress} aria-label={copy.uploading} />}
      </form>
    </section>}

    <div className="documents-feedback" aria-live="polite">
      {status === "loading" && <p role="status">{copy.loading}</p>}
      {status === "loading-record" && <p role="status">{copy.loadingRecord}</p>}
      {status === "success" && <p className="documents-feedback--success" role="status">{copy.success}</p>}
      {status === "error" && errorMessage && <p className="documents-feedback--error" role="alert">{errorMessage}</p>}
      {status !== "error" && errorMessage && <p className="documents-feedback--error" role="status">{errorMessage}</p>}
    </div>
  </div>;
}
