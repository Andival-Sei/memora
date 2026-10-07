// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import axe from "axe-core";
import {listDocumentTypeDefinitions} from "@memora/domain";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {DocumentsWorkspace, type DocumentsCopy} from "./documents-workspace";

const copy: DocumentsCopy = {
  eyebrow: "Memora / Приватный vault",
  title: "Документы",
  description: "Для каждого документа есть свой тип и набор страниц.",
  privateLabel: "Приватно",
  chooseFile: "Выбрать страницы",
  upload: "Загрузить",
  allowed: "JPG, PNG или PDF до 10 МБ",
  empty: "Документов пока нет",
  loading: "Загрузка списка…",
  uploading: "Сохраняем…",
  success: "Страницы сохранены",
  download: "Скачать",
  error: "Не удалось сохранить документ",
  invalidFile: "Неверный формат",
  selectType: "Выберите тип документа",
  typeHint: "Выберите подходящий тип.",
  recordsLabel: "записей",
  fieldCount: "полей",
  fieldsTitle: "Поля документа",
  fieldsNotice: "Поля выбраны по типу.",
  pagesTitle: "Страницы документа",
  choosePages: "Добавить фото или PDF",
  pageLabel: "Страница",
  removePage: "Удалить страницу",
  movePageUp: "Переместить страницу выше",
  movePageDown: "Переместить страницу ниже",
  savePages: "Сохранить страницы",
  savingPages: "Загружаем…",
  openRecord: "Открыть",
  noRecords: "Пока нет записей",
  statusEmpty: "Не распознано",
  statusProcessing: "Обрабатывается",
  statusNeedsReview: "Нужна проверка",
  statusConfirmed: "Подтверждено",
  statusFailed: "Ошибка обработки",
  statusExpired: "Устарело",
  listUnavailable: "Список недоступен",
  pageLimit: "Не более пяти страниц",
  fileLimit: "Не более 10 МБ",
  loadingRecord: "Открываем…",
  recognizedLater: "OCR не подключён: поля пустые.",
  previousUploadsTitle: "Ранее загруженные файлы",
  previousUploadsHint: "Сохранены отдельно от записей и не классифицированы автоматически.",
  untypedDocument: "Без типа документа",
  previousUploadsUnavailable: "Не удалось загрузить прежние файлы.",
  uploadUnavailable: "Загрузка страниц пока недоступна: хранилище записей не готово."
};

const definitions = listDocumentTypeDefinitions();
const record = {
  id: "11111111-1111-4111-8111-111111111111",
  documentType: "ru-passport" as const,
  schemaVersion: 1,
  status: "empty" as const,
  title: null,
  issuedAt: null,
  expiresAt: null,
  assetCount: 0,
  createdAt: "2026-09-19T00:00:00.000Z",
  updatedAt: "2026-09-19T00:00:00.000Z"
};
const workspace = {...record, assetCount: 1, assets: [{
  id: "asset-1", pageIndex: 0, contentType: "image/jpeg" as const, sizeBytes: 42,
  width: 10, height: 10, qualityStatus: "unknown" as const
}]};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {status, headers: {"content-type": "application/json"}});
}

vi.mock("@vercel/blob/client", () => ({upload: vi.fn().mockResolvedValue({url: "https://private.blob.vercel-storage.com/secret"})}));

describe("documents workspace", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockImplementation((input) => Promise.resolve(
    String(input) === "/api/documents" ? jsonResponse({documents: []}) : jsonResponse({records: []})
  ))));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("shows the complete document type catalog and opens the chosen type fields", async () => {
    render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} />);
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByRole("link", {name: /Паспорт РФ/})).toHaveAttribute("href", "/ru/documents?type=ru-passport");
    expect(screen.getByRole("link", {name: /Заграничный паспорт/})).toBeInTheDocument();
    cleanup();
    const {container: selectedContainer} = render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} initialType="ru-passport" />);
    expect(screen.getByRole("heading", {name: "Паспорт РФ"})).toBeInTheDocument();
    expect(screen.getByLabelText("Фамилия")).toBeDisabled();
    expect(screen.getByText(/OCR не подключён/)).toBeInTheDocument();
    const results = await axe.run(selectedContainer, {rules: {"color-contrast": {enabled: false}}});
    expect(results.violations).toEqual([]);
  });

  it("keeps previously uploaded PDFs visible and downloadable without assigning a type", async () => {
    const legacyDocument = {
      id: "22222222-2222-4222-8222-222222222222",
      filename: "previously-uploaded.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      status: "ready",
      createdAt: "2026-09-19T00:00:00.000Z"
    };
    vi.mocked(fetch).mockImplementation((input) => {
      const requestUrl = input instanceof Request ? input.url : input instanceof URL ? input.pathname : input;
      if (requestUrl === "/api/documents") return Promise.resolve(jsonResponse({documents: [legacyDocument]}));
      return Promise.resolve(jsonResponse({records: []}));
    });

    render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} />);

    expect(await screen.findByRole("heading", {name: "Ранее загруженные файлы"})).toBeInTheDocument();
    expect(screen.getByText(legacyDocument.filename)).toBeInTheDocument();
    expect(screen.getByRole("link", {name: `${copy.download}: ${legacyDocument.filename}`})).toHaveAttribute(
      "href",
      `/api/documents/${legacyDocument.id}/download`
    );
    expect(screen.getByText(/Без типа документа/)).toBeInTheDocument();
    expect(screen.queryByText(copy.empty)).not.toBeInTheDocument();
  });

  it("fails closed when the typed-record API is unavailable", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const requestUrl = input instanceof Request ? input.url : input instanceof URL ? input.pathname : input;
      return Promise.resolve(requestUrl === "/api/documents"
        ? jsonResponse({documents: []})
        : jsonResponse({error: {code: "SERVICE_UNAVAILABLE"}}, 503));
    });

    render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} initialType="ru-passport" />);

    expect(await screen.findByText(copy.uploadUnavailable)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.choosePages)).toBeDisabled();
  });

  it("allows selecting multiple pages and reordering them before upload", async () => {
    render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} initialType="ru-passport" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const first = new File(["first"], "front.jpg", {type: "image/jpeg"});
    const second = new File(["second"], "back.jpg", {type: "image/jpeg"});
    fireEvent.change(screen.getByLabelText(copy.choosePages), {target: {files: [first, second]}});
    expect(screen.getByLabelText(copy.choosePages)).toHaveAttribute("multiple");
    expect(screen.getByText(/front.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/back.jpg/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", {name: copy.movePageDown})[0]!);
    const rows = screen.getAllByRole("listitem").filter((item) => item.className.includes("document-page"));
    expect(rows[0]?.textContent).toContain("back.jpg");
  });

  it("creates a typed record and uploads private page data without exposing its Blob URL", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({records: []}))
      .mockResolvedValueOnce(jsonResponse({documents: []}))
      .mockResolvedValueOnce(jsonResponse({record}, 201))
      .mockResolvedValueOnce(jsonResponse({ticket: {
        pathname: "vaults/vault-1/document-records/11111111-1111-4111-8111-111111111111/page-1.jpg",
        contentType: "image/jpeg", maximumSizeInBytes: 10 * 1024 * 1024
      }}))
      .mockResolvedValueOnce(jsonResponse({workspace}));

    render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} initialType="ru-passport" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText(copy.choosePages), {
      target: {files: [new File(["jpeg"], "passport-front.jpg", {type: "image/jpeg"})]}
    });
    fireEvent.click(screen.getByRole("button", {name: copy.savePages}));

    expect(await screen.findByText(copy.success)).toBeInTheDocument();
    expect(await screen.findByAltText("Страница 1")).toHaveAttribute("src", `/api/document-records/${record.id}/assets/asset-1`);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({method: "POST"});
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({documentType: "ru-passport"}));
    expect(document.body.textContent).not.toContain("private.blob.vercel-storage.com");
  });

  it("rejects unsupported files and protects localized UI from provider error details", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<DocumentsWorkspace copy={copy} locale="ru" definitions={definitions} initialType="ru-passport" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText(copy.choosePages), {
      target: {files: [new File(["text"], "notes.txt", {type: "text/plain"})]}
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.invalidFile);
    expect(document.body.textContent).not.toContain("text/plain");
  });
});
