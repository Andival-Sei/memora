"use client";

import {documentErrorSchema, documentListResponseSchema, publicDocumentSchema, type PublicDocument} from "@memora/contracts";
import type {Locale} from "@/lib/i18n/routing";
import {useCallback, useEffect, useRef, useState} from "react";

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
};

const MAX_BYTES = 10 * 1024 * 1024;

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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function DocumentsWorkspace({copy, locale}: {copy: DocumentsCopy; locale: Locale}) {
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "uploading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/documents", {cache: "no-store", signal: signal ?? null});
      const payload = documentListResponseSchema.safeParse(await readJson(response));
      if (!response.ok || !payload.success) throw new Error("document-list-failed");
      setDocuments(payload.data.documents);
      setErrorMessage(null);
      setStatus("idle");
    } catch {
      if (!signal?.aborted) {
        setStatus("error");
        setErrorMessage(copy.error);
      }
    }
  }, [copy.error]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDocuments(controller.signal);
    return () => controller.abort();
  }, [loadDocuments]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatus("error");
      setErrorMessage(copy.invalidFile);
      return;
    }
    if (selectedFile.size > MAX_BYTES) {
      setStatus("error");
      setErrorMessage(copy.error);
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);
    const formData = new FormData();
    formData.set("file", selectedFile);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        cache: "no-store"
      });
      const rawPayload = await readJson(response);
      const documentPayload = typeof rawPayload === "object" && rawPayload !== null && "document" in rawPayload
        ? publicDocumentSchema.safeParse(rawPayload.document)
        : {success: false as const};
      if (!response.ok || !documentPayload.success) {
        const errorPayload = documentErrorSchema.safeParse(rawPayload);
        throw new Error(errorPayload.success ? errorPayload.data.error.code : "document-upload-failed");
      }
      setDocuments((current) => [documentPayload.data, ...current.filter((item) => item.id !== documentPayload.data.id)]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage(copy.error);
    }
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

    <form className="upload-card" aria-busy={status === "uploading"} onSubmit={(event) => { void onSubmit(event); }}>
      <label className="upload-dropzone" htmlFor="document-file">
        <span className="upload-dropzone__icon" aria-hidden="true">↥</span>
        <span className="upload-dropzone__title">{copy.chooseFile}</span>
        <span className="upload-dropzone__hint">{selectedFile ? selectedFile.name : copy.allowed}</span>
        <input
          ref={fileInputRef}
          id="document-file"
          name="file"
          type="file"
          aria-label={copy.chooseFile}
          accept=".pdf,application/pdf"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="upload-card__footer">
        <span className="upload-card__file">{selectedFile ? formatBytes(selectedFile.size, locale) : copy.allowed}</span>
        <button className="button button--primary" type="submit" disabled={status === "uploading" || !selectedFile}>
          {status === "uploading" ? copy.uploading : copy.upload}
        </button>
      </div>
    </form>

    <div className="documents-feedback" aria-live="polite">
      {status === "loading" && <p role="status">{copy.loading}</p>}
      {status === "success" && <p className="documents-feedback--success" role="status">{copy.success}</p>}
      {status === "error" && errorMessage && <p className="documents-feedback--error" role="alert">{errorMessage}</p>}
    </div>

    <section className="documents-list" aria-labelledby="documents-list-title">
      <div className="documents-list__heading"><h3 id="documents-list-title">{copy.title}</h3><span>{documents.length}</span></div>
      {status !== "loading" && documents.length === 0 && <p className="documents-list__empty">{copy.empty}</p>}
      {documents.length > 0 && <ul>
        {documents.map((document) => <li className="document-row" key={document.id}>
          <span className="document-row__icon" aria-hidden="true">PDF</span>
          <span className="document-row__meta"><strong>{document.filename}</strong><small>{formatBytes(document.sizeBytes, locale)} · {formatDate(document.createdAt, locale)}</small></span>
          <a className="button button--small" href={`/api/documents/${encodeURIComponent(document.id)}/download`}>{copy.download}</a>
        </li>)}
      </ul>}
    </section>
  </div>;
}
