export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_FILENAME_MAX_LENGTH = 120;
export const DOCUMENT_CONTENT_TYPE = "application/pdf" as const;

export type DocumentErrorCode =
  | "DOCUMENT_FILE_TOO_LARGE"
  | "DOCUMENT_INVALID_FILENAME"
  | "DOCUMENT_INVALID_MAGIC_BYTES"
  | "DOCUMENT_UNSUPPORTED_TYPE"
  | "DOCUMENT_UPLOAD_FAILED";

const errorMessages: Record<DocumentErrorCode, string> = {
  DOCUMENT_FILE_TOO_LARGE: "Файл превышает допустимый размер.",
  DOCUMENT_INVALID_FILENAME: "Имя PDF-файла недействительно.",
  DOCUMENT_INVALID_MAGIC_BYTES: "Содержимое файла не является PDF.",
  DOCUMENT_UNSUPPORTED_TYPE: "Поддерживаются только PDF-файлы.",
  DOCUMENT_UPLOAD_FAILED: "Не удалось сохранить документ."
};

export class DocumentValidationError extends Error {
  readonly code: Exclude<DocumentErrorCode, "DOCUMENT_UPLOAD_FAILED">;

  constructor(code: Exclude<DocumentErrorCode, "DOCUMENT_UPLOAD_FAILED">) {
    super(errorMessages[code]);
    this.name = "DocumentValidationError";
    this.code = code;
  }
}

export class DocumentServiceError extends Error {
  readonly code = "DOCUMENT_UPLOAD_FAILED" as const;

  constructor() {
    super(errorMessages.DOCUMENT_UPLOAD_FAILED);
    this.name = "DocumentServiceError";
  }
}

export interface DocumentUploadInput {
  filename: string;
  contentType: string;
  size: number;
  bytes: ArrayBuffer;
}

export interface ValidatedDocumentUpload {
  filename: string;
  contentType: typeof DOCUMENT_CONTENT_TYPE;
  size: number;
}

export interface PersistedDocument {
  id: string;
  vaultId: string;
  blobPath: string;
  originalFilename: string;
  contentType: typeof DOCUMENT_CONTENT_TYPE;
  sizeBytes: number;
  status: "ready";
  createdAt: Date;
}

export interface PublicDocument {
  id: string;
  filename: string;
  contentType: typeof DOCUMENT_CONTENT_TYPE;
  sizeBytes: number;
  status: "ready";
  createdAt: string;
}

export interface DocumentRepository {
  ensurePersonalVault(clerkId: string): Promise<{vaultId: string}>;
  createDocument(input: {
    id: string;
    vaultId: string;
    blobPath: string;
    originalFilename: string;
    contentType: typeof DOCUMENT_CONTENT_TYPE;
    sizeBytes: number;
  }): Promise<PersistedDocument>;
  listDocuments(vaultId: string): Promise<PersistedDocument[]>;
  findDocument(vaultId: string, documentId: string): Promise<PersistedDocument | null>;
  recordAudit(input: {
    vaultId: string;
    documentId?: string;
    actorClerkId: string;
    action: "upload" | "download";
    result: "success" | "failure";
  }): Promise<void>;
}

export interface PrivateBlobStore {
  put(pathname: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<{body: ReadableStream<Uint8Array>} | null>;
  delete(pathname: string): Promise<void>;
}

export interface DocumentDownload {
  filename: string;
  contentType: typeof DOCUMENT_CONTENT_TYPE;
  sizeBytes: number;
  body: ReadableStream<Uint8Array>;
}

export interface DocumentService {
  upload(clerkId: string, input: DocumentUploadInput): Promise<PublicDocument>;
  list(clerkId: string): Promise<PublicDocument[]>;
  download(clerkId: string, documentId: string): Promise<DocumentDownload | null>;
}

function normalizeFilename(filename: string): string {
  const withoutControl = [...filename]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join("");
  const basename = withoutControl.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "";
  if (!basename || basename === "." || basename === "..") return "";
  if (basename.length <= DOCUMENT_FILENAME_MAX_LENGTH) return basename;
  const extension = ".pdf";
  return `${basename.slice(0, DOCUMENT_FILENAME_MAX_LENGTH - extension.length)}${extension}`;
}

export function validateDocumentUpload(input: DocumentUploadInput): ValidatedDocumentUpload {
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > DOCUMENT_MAX_BYTES) {
    throw new DocumentValidationError("DOCUMENT_FILE_TOO_LARGE");
  }
  if (input.contentType !== DOCUMENT_CONTENT_TYPE) {
    throw new DocumentValidationError("DOCUMENT_UNSUPPORTED_TYPE");
  }

  const filename = normalizeFilename(input.filename);
  if (!filename || !filename.toLowerCase().endsWith(".pdf")) {
    throw new DocumentValidationError("DOCUMENT_INVALID_FILENAME");
  }

  const header = new TextDecoder().decode(new Uint8Array(input.bytes).subarray(0, 5));
  if (header !== "%PDF-") {
    throw new DocumentValidationError("DOCUMENT_INVALID_MAGIC_BYTES");
  }

  return {filename, contentType: DOCUMENT_CONTENT_TYPE, size: input.size};
}

function toPublicDocument(document: PersistedDocument): PublicDocument {
  return {
    id: document.id,
    filename: document.originalFilename,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    createdAt: document.createdAt.toISOString()
  };
}

function isValidationError(error: unknown): error is DocumentValidationError {
  return error instanceof DocumentValidationError;
}

export function createDocumentService(dependencies: {
  repository: DocumentRepository;
  blobStore: PrivateBlobStore;
  createId: () => string;
}): DocumentService {
  const {repository, blobStore, createId} = dependencies;

  const recordAuditSafely = async (input: Parameters<DocumentRepository["recordAudit"]>[0]) => {
    try {
      await repository.recordAudit(input);
    } catch {
      // An audit outage must not leak provider/DB details to the user or turn a
      // successfully persisted document into a second, inconsistent operation.
    }
  };

  return {
    async upload(clerkId, input) {
      const validated = validateDocumentUpload(input);
      const {vaultId} = await repository.ensurePersonalVault(clerkId);
      const documentId = createId();
      const blobPath = `vaults/${vaultId}/documents/${documentId}.pdf`;
      let blobWritten = false;

      try {
        await blobStore.put(blobPath, input.bytes, validated.contentType);
        blobWritten = true;
        const persisted = await repository.createDocument({
          id: documentId,
          vaultId,
          blobPath,
          originalFilename: validated.filename,
          contentType: validated.contentType,
          sizeBytes: validated.size
        });
        await recordAuditSafely({
          vaultId,
          documentId,
          actorClerkId: clerkId,
          action: "upload",
          result: "success"
        });
        return toPublicDocument(persisted);
      } catch (error) {
        if (blobWritten) {
          try {
            await blobStore.delete(blobPath);
          } catch {
            // Do not replace the stable application error with provider details.
          }
        }
        await recordAuditSafely({
          vaultId,
          documentId,
          actorClerkId: clerkId,
          action: "upload",
          result: "failure"
        });
        if (isValidationError(error)) throw error;
        throw new DocumentServiceError();
      }
    },

    async list(clerkId) {
      const {vaultId} = await repository.ensurePersonalVault(clerkId);
      const documents = await repository.listDocuments(vaultId);
      return documents.slice(0, 100).map(toPublicDocument);
    },

    async download(clerkId, documentId) {
      const {vaultId} = await repository.ensurePersonalVault(clerkId);
      const document = await repository.findDocument(vaultId, documentId);
      if (!document) return null;
      const blob = await blobStore.get(document.blobPath);
      if (!blob) {
        await recordAuditSafely({
          vaultId,
          documentId,
          actorClerkId: clerkId,
          action: "download",
          result: "failure"
        });
        return null;
      }
      await recordAuditSafely({
        vaultId,
        documentId,
        actorClerkId: clerkId,
        action: "download",
        result: "success"
      });
      return {
        filename: document.originalFilename,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes,
        body: blob.body
      };
    }
  };
}
