// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {DocumentsWorkspace} from "./documents-workspace";

const copy = {
  eyebrow: "Memora / Приватный vault",
  title: "Документы",
  description: "Сохраняйте важные PDF приватно.",
  privateLabel: "Приватно",
  chooseFile: "Выбрать PDF",
  upload: "Загрузить",
  allowed: "PDF до 10 МБ",
  empty: "Документов пока нет",
  loading: "Загрузка списка…",
  uploading: "Сохраняем…",
  success: "Документ сохранён",
  download: "Скачать",
  error: "Не удалось сохранить документ",
  invalidFile: "Выберите PDF-файл"
};

const documentItem = {
  id: "11111111-1111-4111-8111-111111111111",
  filename: "passport.pdf",
  contentType: "application/pdf" as const,
  sizeBytes: 12,
  status: "ready" as const,
  createdAt: "2026-09-19T00:00:00.000Z"
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {"content-type": "application/json"}
  });
}

describe("documents workspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({documents: []})));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads a scoped list and provides a keyboard-operable PDF upload", async () => {
    render(<DocumentsWorkspace copy={copy} locale="ru" />);
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.chooseFile)).toHaveAttribute("accept", ".pdf,application/pdf");
    expect(screen.getByRole("button", {name: copy.upload})).toBeDisabled();
  });

  it("refreshes the list after a successful upload without exposing a Blob URL", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({documents: []}))
      .mockResolvedValueOnce(jsonResponse({document: documentItem}, 201));
    render(<DocumentsWorkspace copy={copy} locale="ru" />);
    await screen.findByText(copy.empty);
    fireEvent.change(screen.getByLabelText(copy.chooseFile), {
      target: {files: [new File(["%PDF-1.7"], "passport.pdf", {type: "application/pdf"})]}
    });
    fireEvent.click(screen.getByRole("button", {name: copy.upload}));

    expect(await screen.findByText(copy.success)).toBeInTheDocument();
    expect(await screen.findByText(documentItem.filename)).toBeInTheDocument();
    expect(screen.getByRole("link", {name: copy.download})).toHaveAttribute(
      "href",
      `/api/documents/${documentItem.id}/download`
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const postInit = fetchMock.mock.calls[1]?.[1];
    expect(postInit?.method).toBe("POST");
    expect(postInit?.body).toBeInstanceOf(FormData);
    expect(document.body.textContent).not.toContain("blob.invalid");
  });

  it("shows a localized safe error when the API rejects the file", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({documents: []}))
      .mockResolvedValueOnce(jsonResponse({error: {code: "DOCUMENT_INVALID_MAGIC_BYTES", message: "bad"}}, 400));
    render(<DocumentsWorkspace copy={copy} locale="ru" />);
    await screen.findByText(copy.empty);
    fireEvent.change(screen.getByLabelText(copy.chooseFile), {
      target: {files: [new File(["not pdf"], "notes.pdf", {type: "application/pdf"})]}
    });
    fireEvent.click(screen.getByRole("button", {name: copy.upload}));
    expect(await screen.findByText(copy.error)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("bad");
  });
});
