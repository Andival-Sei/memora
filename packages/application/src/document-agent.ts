import {createHash} from "node:crypto";
import {basename, isAbsolute, relative, resolve, sep} from "node:path";
import {z} from "zod";
import {
  verifyDocumentFixture,
  type DocumentFixtureVerificationRequest,
  type DocumentFixtureVerificationResult
} from "./document-fixtures";

export const documentTypeSchema = z.enum([
  "ru-passport",
  "international-passport",
  "drivers-license",
  "tax-or-insurance",
  "birth-certificate",
  "medical-policy",
  "contract",
  "other"
]);

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentAgentScopeName =
  | "documents:read"
  | "documents:ingest"
  | "documents:review"
  | "documents:confirm"
  | "documents:test";

export interface DocumentAgentScope {
  actorId: string;
  vaultId: string;
  scopes: ReadonlySet<DocumentAgentScopeName>;
}

export type MemoraScope = DocumentAgentScope;

export interface DocumentTypeField {
  key: string;
  label: {ru: string; en: string};
  dataType: "text" | "date";
  required: boolean;
  sensitivity: "personal" | "identifier" | "public";
}

export interface DocumentTypeSummary {
  id: DocumentType;
  schemaVersion: number;
  label: {ru: string; en: string};
  acceptedContentTypes: readonly string[];
  fields: readonly DocumentTypeField[];
}

export interface FieldEvidence {
  assetId: string;
  page: number;
  boundingBox?: {left: number; top: number; width: number; height: number};
}

export interface DocumentFieldDraft {
  key: string;
  label: {ru: string; en: string};
  displayValue: string | null;
  normalizedValue: string | null;
  confidence: number | null;
  evidence: FieldEvidence[];
  reviewStatus: "proposed" | "accepted" | "rejected" | "needs_review";
}

export interface DocumentWorkspaceAsset {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  pageIndex: number;
}

export interface DocumentWorkspace {
  recordId: string;
  vaultId: string;
  documentType: DocumentType;
  status: "staged" | "processing" | "needs_review" | "confirmed" | "failed";
  assets: DocumentWorkspaceAsset[];
  draftFields: DocumentFieldDraft[];
  canonicalFields: Record<string, string>;
  warnings: string[];
}

export interface StageLocalFileInput {
  documentType: DocumentType;
  localPath: string;
  filename?: string;
  testFixture?: boolean;
}

export interface StagedAsset {
  assetHandle: string;
  recordId: string;
  documentType: DocumentType;
  filename: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: string;
}

export interface ConfirmationChange {
  key: string;
  normalizedValue: string | null;
  displayValue: string | null;
}

export interface ConfirmationRequest {
  recordId: string;
  changes: ConfirmationChange[];
}

export interface ConfirmationDraft {
  token: string;
  recordId: string;
  changes: ConfirmationChange[];
  expiresAt: string;
}

export interface LocalFile {
  filename: string;
  contentType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

export interface LocalFileReader {
  realpath(localPath: string): Promise<string>;
  read(localPath: string): Promise<LocalFile>;
}

export interface DocumentAgentAssetRecord extends StagedAsset {
  actorId: string;
  vaultId: string;
  assetId: string;
  bytes: Uint8Array;
  consumedAt?: string;
}

export interface DocumentAgentConfirmationRecord extends ConfirmationDraft {
  actorId: string;
  vaultId: string;
  payloadHash: string;
  usedAt?: string;
}

export interface DocumentAgentStore {
  saveStagedAsset(asset: DocumentAgentAssetRecord): Promise<void>;
  consumeStagedAsset(scope: DocumentAgentScope, assetHandle: string): Promise<{
    status: "ready" | "missing" | "replayed";
    asset?: DocumentAgentAssetRecord;
  }>;
  saveWorkspace(workspace: DocumentWorkspace): Promise<void>;
  getWorkspace(scope: DocumentAgentScope, recordId: string): Promise<DocumentWorkspace | null>;
  saveConfirmation(confirmation: DocumentAgentConfirmationRecord): Promise<void>;
  consumeConfirmation(scope: DocumentAgentScope, token: string): Promise<{
    status: "ready" | "missing" | "replayed";
    confirmation?: DocumentAgentConfirmationRecord;
  }>;
}

export interface DocumentExtractor {
  extract(input: {
    scope: DocumentAgentScope;
    asset: Readonly<DocumentAgentAssetRecord>;
    workspace: Readonly<DocumentWorkspace>;
  }): Promise<{
    runId: string;
    fields: DocumentFieldDraft[];
    warnings: string[];
  }>;
}

export interface DocumentAgentClock {
  now(): Date;
}

export type DocumentAgentIdGenerator = (prefix: string) => string;

export interface DocumentAgentDependencies {
  stagingRoot: string;
  reader: LocalFileReader;
  store: DocumentAgentStore;
  extractor: DocumentExtractor;
  clock: DocumentAgentClock;
  idGenerator: DocumentAgentIdGenerator;
  maxAssetBytes?: number;
}

export type DocumentAgentErrorCode =
  | "MISSING_SCOPE"
  | "INVALID_DOCUMENT_TYPE"
  | "PATH_NOT_ALLOWED"
  | "INVALID_ASSET"
  | "ASSET_EXPIRED"
  | "ASSET_ALREADY_USED"
  | "RECORD_NOT_FOUND"
  | "CONFIRMATION_NOT_FOUND"
  | "TOKEN_REPLAYED"
  | "CONFIRMATION_EXPIRED"
  | "PAYLOAD_MISMATCH"
  | "USER_CONFIRMATION_REQUIRED"
  | "EXTRACTION_FAILED"
  | "INVALID_FIXTURE";

const errorMessages: Record<DocumentAgentErrorCode, string> = {
  MISSING_SCOPE: "Недостаточно разрешений для этой операции.",
  INVALID_DOCUMENT_TYPE: "Неизвестный тип документа.",
  PATH_NOT_ALLOWED: "Файл находится вне разрешённой области staging.",
  INVALID_ASSET: "Файл не прошёл проверку загрузки.",
  ASSET_EXPIRED: "Срок действия загрузки истёк.",
  ASSET_ALREADY_USED: "Загрузка уже была использована.",
  RECORD_NOT_FOUND: "Документ не найден.",
  CONFIRMATION_NOT_FOUND: "Подтверждение не найдено.",
  TOKEN_REPLAYED: "Подтверждение уже было использовано.",
  CONFIRMATION_EXPIRED: "Срок действия подтверждения истёк.",
  PAYLOAD_MISMATCH: "Данные подтверждения изменились.",
  USER_CONFIRMATION_REQUIRED: "Требуется явное подтверждение пользователя.",
  EXTRACTION_FAILED: "Не удалось подготовить черновик распознавания.",
  INVALID_FIXTURE: "Fixture не прошёл проверку формата."
};

export class ApplicationError extends Error {
  constructor(readonly code: DocumentAgentErrorCode) {
    super(errorMessages[code]);
    this.name = "ApplicationError";
  }
}

const DOCUMENT_TYPES: readonly DocumentTypeSummary[] = [
  {
    id: "ru-passport",
    schemaVersion: 1,
    label: {ru: "Паспорт РФ", en: "Russian passport"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [
      {key: "full_name", label: {ru: "ФИО", en: "Full name"}, dataType: "text", required: true, sensitivity: "personal"},
      {key: "birth_date", label: {ru: "Дата рождения", en: "Date of birth"}, dataType: "date", required: true, sensitivity: "personal"},
      {key: "series_number", label: {ru: "Серия и номер", en: "Series and number"}, dataType: "text", required: true, sensitivity: "identifier"},
      {key: "issue_date", label: {ru: "Дата выдачи", en: "Issue date"}, dataType: "date", required: true, sensitivity: "personal"},
      {key: "department_code", label: {ru: "Код подразделения", en: "Department code"}, dataType: "text", required: false, sensitivity: "identifier"}
    ]
  },
  {
    id: "international-passport",
    schemaVersion: 1,
    label: {ru: "Заграничный паспорт", en: "International passport"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [
      {key: "full_name", label: {ru: "ФИО", en: "Full name"}, dataType: "text", required: true, sensitivity: "personal"},
      {key: "passport_number", label: {ru: "Номер паспорта", en: "Passport number"}, dataType: "text", required: true, sensitivity: "identifier"},
      {key: "birth_date", label: {ru: "Дата рождения", en: "Date of birth"}, dataType: "date", required: true, sensitivity: "personal"},
      {key: "expiry_date", label: {ru: "Срок действия", en: "Expiry date"}, dataType: "date", required: true, sensitivity: "personal"}
    ]
  },
  {
    id: "drivers-license",
    schemaVersion: 1,
    label: {ru: "Водительское удостоверение", en: "Driver's license"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [
      {key: "full_name", label: {ru: "ФИО", en: "Full name"}, dataType: "text", required: true, sensitivity: "personal"},
      {key: "license_number", label: {ru: "Номер удостоверения", en: "License number"}, dataType: "text", required: true, sensitivity: "identifier"},
      {key: "issue_date", label: {ru: "Дата выдачи", en: "Issue date"}, dataType: "date", required: true, sensitivity: "personal"},
      {key: "expiry_date", label: {ru: "Срок действия", en: "Expiry date"}, dataType: "date", required: true, sensitivity: "personal"}
    ]
  },
  {
    id: "tax-or-insurance",
    schemaVersion: 1,
    label: {ru: "СНИЛС или ИНН", en: "Tax or insurance document"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [{key: "identifier", label: {ru: "Идентификатор", en: "Identifier"}, dataType: "text", required: true, sensitivity: "identifier"}]
  },
  {
    id: "birth-certificate",
    schemaVersion: 1,
    label: {ru: "Свидетельство о рождении", en: "Birth certificate"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [{key: "full_name", label: {ru: "ФИО", en: "Full name"}, dataType: "text", required: true, sensitivity: "personal"}]
  },
  {
    id: "medical-policy",
    schemaVersion: 1,
    label: {ru: "Медицинский документ", en: "Medical document"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [{key: "policy_number", label: {ru: "Номер полиса", en: "Policy number"}, dataType: "text", required: true, sensitivity: "identifier"}]
  },
  {
    id: "contract",
    schemaVersion: 1,
    label: {ru: "Договор", en: "Contract"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [{key: "title", label: {ru: "Название", en: "Title"}, dataType: "text", required: true, sensitivity: "public"}]
  },
  {
    id: "other",
    schemaVersion: 1,
    label: {ru: "Другой документ", en: "Other document"},
    acceptedContentTypes: ["image/jpeg", "image/png", "application/pdf"],
    fields: [{key: "title", label: {ru: "Название", en: "Title"}, dataType: "text", required: true, sensitivity: "public"}]
  }
];

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const HANDLE_TTL_MS = 15 * 60 * 1000;

function requireScope(scope: DocumentAgentScope, required: DocumentAgentScopeName): void {
  if (!scope.scopes.has(required)) throw new ApplicationError("MISSING_SCOPE");
}

function getDocumentType(documentType: string): DocumentTypeSummary {
  const parsed = documentTypeSchema.safeParse(documentType);
  if (!parsed.success) throw new ApplicationError("INVALID_DOCUMENT_TYPE");
  const summary = DOCUMENT_TYPES.find((candidate) => candidate.id === parsed.data);
  if (!summary) throw new ApplicationError("INVALID_DOCUMENT_TYPE");
  return summary;
}

function isInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const child = relative(resolvedRoot, resolvedCandidate);
  return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function hasKnownMagic(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "application/pdf") {
    return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  }
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  return false;
}

function normalizeFilename(filename: string): string {
  const withoutControl = [...filename]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join("");
  const normalized = basename(withoutControl.replaceAll("\\", "/"));
  return normalized.slice(0, 120) || "document";
}

function payloadHash(changes: readonly ConfirmationChange[]): string {
  const normalized = [...changes]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(({key, normalizedValue, displayValue}) => ({key, normalizedValue, displayValue}));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function copyWorkspace(workspace: DocumentWorkspace): DocumentWorkspace {
  return structuredClone(workspace);
}

function copyTypes(): DocumentTypeSummary[] {
  return DOCUMENT_TYPES.map((documentType) => structuredClone(documentType));
}

export interface DocumentAgentUseCases {
  listTypes(scope: DocumentAgentScope): Promise<DocumentTypeSummary[]>;
  stageLocalFile(scope: DocumentAgentScope, input: StageLocalFileInput): Promise<StagedAsset>;
  getWorkspace(scope: DocumentAgentScope, recordId: string): Promise<DocumentWorkspace>;
  runExtraction(scope: DocumentAgentScope, assetHandle: string): Promise<DocumentWorkspace>;
  createConfirmation(scope: DocumentAgentScope, input: ConfirmationRequest): Promise<ConfirmationDraft>;
  confirmFields(scope: DocumentAgentScope, input: {token: string; userConfirmed: boolean}): Promise<DocumentWorkspace>;
  verifyFixture(scope: DocumentAgentScope, input: DocumentFixtureVerificationRequest): Promise<DocumentFixtureVerificationResult>;
}

function ensureScopeMatch(scope: DocumentAgentScope, actorId: string, vaultId: string): void {
  if (scope.actorId !== actorId || scope.vaultId !== vaultId) throw new ApplicationError("RECORD_NOT_FOUND");
}

export function createDocumentAgentUseCases(dependencies: DocumentAgentDependencies): DocumentAgentUseCases {
  const maxAssetBytes = dependencies.maxAssetBytes ?? MAX_ASSET_BYTES;

  return {
    async listTypes(scope) {
      await Promise.resolve();
      requireScope(scope, "documents:read");
      return copyTypes();
    },

    async stageLocalFile(scope, input) {
      requireScope(scope, "documents:ingest");
      const type = getDocumentType(input.documentType);
      if (input.testFixture) requireScope(scope, "documents:test");

      const candidatePath = resolve(input.localPath);
      if (!isInsideRoot(dependencies.stagingRoot, candidatePath)) {
        throw new ApplicationError("PATH_NOT_ALLOWED");
      }

      let actualPath: string;
      try {
        actualPath = await dependencies.reader.realpath(candidatePath);
      } catch {
        throw new ApplicationError("PATH_NOT_ALLOWED");
      }
      if (!isInsideRoot(dependencies.stagingRoot, actualPath)) {
        throw new ApplicationError("PATH_NOT_ALLOWED");
      }

      let file: LocalFile;
      try {
        file = await dependencies.reader.read(actualPath);
      } catch {
        throw new ApplicationError("INVALID_ASSET");
      }
      if (!type.acceptedContentTypes.includes(file.contentType) ||
        !Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0 || file.sizeBytes > maxAssetBytes ||
        file.bytes.byteLength !== file.sizeBytes || !hasKnownMagic(file.contentType, file.bytes)) {
        throw new ApplicationError("INVALID_ASSET");
      }

      const now = dependencies.clock.now();
      const recordId = dependencies.idGenerator("record");
      const assetId = dependencies.idGenerator("asset");
      const assetHandle = dependencies.idGenerator("handle");
      const expiresAt = new Date(now.getTime() + HANDLE_TTL_MS).toISOString();
      const filename = normalizeFilename(input.filename?.trim() || file.filename);
      const workspace: DocumentWorkspace = {
        recordId,
        vaultId: scope.vaultId,
        documentType: type.id,
        status: "staged",
        assets: [{id: assetId, filename, contentType: file.contentType, sizeBytes: file.sizeBytes, pageIndex: 1}],
        draftFields: [],
        canonicalFields: {},
        warnings: []
      };
      await dependencies.store.saveStagedAsset({
        assetHandle,
        recordId,
        documentType: type.id,
        filename,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        expiresAt,
        actorId: scope.actorId,
        vaultId: scope.vaultId,
        assetId,
        bytes: file.bytes
      });
      await dependencies.store.saveWorkspace(workspace);
      return {assetHandle, recordId, documentType: type.id, filename, contentType: file.contentType, sizeBytes: file.sizeBytes, expiresAt};
    },

    async getWorkspace(scope, recordId) {
      requireScope(scope, "documents:read");
      const workspace = await dependencies.store.getWorkspace(scope, recordId);
      if (!workspace) throw new ApplicationError("RECORD_NOT_FOUND");
      return copyWorkspace(workspace);
    },

    async runExtraction(scope, assetHandle) {
      requireScope(scope, "documents:review");
      const consumedAsset = await dependencies.store.consumeStagedAsset(scope, assetHandle);
      if (consumedAsset.status === "replayed") throw new ApplicationError("ASSET_ALREADY_USED");
      if (consumedAsset.status !== "ready" || !consumedAsset.asset) throw new ApplicationError("ASSET_EXPIRED");
      const storedAsset = consumedAsset.asset;
      if (new Date(storedAsset.expiresAt).getTime() <= dependencies.clock.now().getTime()) {
        throw new ApplicationError("ASSET_EXPIRED");
      }
      const workspace = await dependencies.store.getWorkspace(scope, storedAsset.recordId);
      if (!workspace) throw new ApplicationError("RECORD_NOT_FOUND");
      const processing = {...workspace, status: "processing" as const};
      await dependencies.store.saveWorkspace(processing);
      try {
        const extraction = await dependencies.extractor.extract({scope, asset: storedAsset, workspace: processing});
        const reviewed: DocumentWorkspace = {
          ...processing,
          status: "needs_review",
          draftFields: structuredClone(extraction.fields),
          warnings: [...extraction.warnings]
        };
        await dependencies.store.saveWorkspace(reviewed);
        return copyWorkspace(reviewed);
      } catch {
        const failed: DocumentWorkspace = {...processing, status: "failed", warnings: [errorMessages.EXTRACTION_FAILED]};
        await dependencies.store.saveWorkspace(failed);
        throw new ApplicationError("EXTRACTION_FAILED");
      }
    },

    async createConfirmation(scope, input) {
      requireScope(scope, "documents:review");
      const workspace = await dependencies.store.getWorkspace(scope, input.recordId);
      if (!workspace) throw new ApplicationError("RECORD_NOT_FOUND");
      const draftKeys = new Set(workspace.draftFields.map((field) => field.key));
      if (input.changes.some((change) => !draftKeys.has(change.key))) {
        throw new ApplicationError("PAYLOAD_MISMATCH");
      }
      const now = dependencies.clock.now();
      const expiresAt = new Date(now.getTime() + HANDLE_TTL_MS).toISOString();
      const confirmation: DocumentAgentConfirmationRecord = {
        token: dependencies.idGenerator("confirmation"),
        recordId: input.recordId,
        changes: structuredClone(input.changes),
        expiresAt,
        actorId: scope.actorId,
        vaultId: scope.vaultId,
        payloadHash: payloadHash(input.changes)
      };
      await dependencies.store.saveConfirmation(confirmation);
      return {token: confirmation.token, recordId: confirmation.recordId, changes: structuredClone(confirmation.changes), expiresAt};
    },

    async confirmFields(scope, input) {
      requireScope(scope, "documents:confirm");
      if (!input.userConfirmed) throw new ApplicationError("USER_CONFIRMATION_REQUIRED");
      const result = await dependencies.store.consumeConfirmation(scope, input.token);
      if (result.status === "missing") throw new ApplicationError("CONFIRMATION_NOT_FOUND");
      if (result.status === "replayed" || !result.confirmation) throw new ApplicationError("TOKEN_REPLAYED");
      const confirmation = result.confirmation;
      ensureScopeMatch(scope, confirmation.actorId, confirmation.vaultId);
      if (new Date(confirmation.expiresAt).getTime() <= dependencies.clock.now().getTime()) {
        throw new ApplicationError("CONFIRMATION_EXPIRED");
      }
      if (payloadHash(confirmation.changes) !== confirmation.payloadHash) {
        throw new ApplicationError("PAYLOAD_MISMATCH");
      }
      const workspace = await dependencies.store.getWorkspace(scope, confirmation.recordId);
      if (!workspace) throw new ApplicationError("RECORD_NOT_FOUND");
      const canonicalFields = {...workspace.canonicalFields};
      for (const change of confirmation.changes) {
        if (change.normalizedValue === null) delete canonicalFields[change.key];
        else canonicalFields[change.key] = change.normalizedValue;
      }
      const confirmed: DocumentWorkspace = {
        ...workspace,
        status: "confirmed",
        canonicalFields
      };
      await dependencies.store.saveWorkspace(confirmed);
      return copyWorkspace(confirmed);
    },

    async verifyFixture(scope, input) {
      await Promise.resolve();
      requireScope(scope, "documents:test");
      const parsedDocumentType = documentTypeSchema.safeParse(input.manifest.documentType);
      const fixtureId = input.manifest.fixtureId.trim();
      const expectedKeys = input.manifest.fields.map((field) => field.key);
      const actualKeys = input.actualFields.map((field) => field.key);
      const hasDuplicate = (keys: string[]) => new Set(keys).size !== keys.length;
      const hasInvalidConfidence = input.actualFields.some((field) => field.confidence !== null &&
        (!Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 1));
      if (!parsedDocumentType.success || !fixtureId || fixtureId.length > 120 ||
        input.manifest.fields.length > 100 || input.actualFields.length > 100 ||
        expectedKeys.some((key) => !key.trim()) || actualKeys.some((key) => !key.trim()) ||
        hasDuplicate(expectedKeys) || hasDuplicate(actualKeys) || hasInvalidConfidence) {
        throw new ApplicationError("INVALID_FIXTURE");
      }
      return verifyDocumentFixture({...input.manifest, fixtureId, documentType: parsedDocumentType.data}, input.actualFields);
    }
  };
}

export function createInMemoryDocumentAgentStore(): DocumentAgentStore {
  const assets = new Map<string, DocumentAgentAssetRecord>();
  const workspaces = new Map<string, DocumentWorkspace>();
  const confirmations = new Map<string, DocumentAgentConfirmationRecord>();

  return {
    saveStagedAsset(asset) {
      assets.set(asset.assetHandle, structuredClone(asset));
      return Promise.resolve();
    },
    consumeStagedAsset(scope, assetHandle) {
      const asset = assets.get(assetHandle);
      if (!asset || asset.actorId !== scope.actorId || asset.vaultId !== scope.vaultId) {
        return Promise.resolve({status: "missing" as const});
      }
      if (asset.consumedAt) return Promise.resolve({status: "replayed" as const});
      const consumed = {...asset, consumedAt: new Date().toISOString()};
      assets.set(assetHandle, consumed);
      return Promise.resolve({status: "ready" as const, asset: structuredClone(consumed)});
    },
    saveWorkspace(workspace) {
      workspaces.set(workspace.recordId, copyWorkspace(workspace));
      return Promise.resolve();
    },
    getWorkspace(scope, recordId) {
      const workspace = workspaces.get(recordId);
      if (!workspace || workspace.vaultId !== scope.vaultId) return Promise.resolve(null);
      return Promise.resolve(copyWorkspace(workspace));
    },
    saveConfirmation(confirmation) {
      confirmations.set(confirmation.token, structuredClone(confirmation));
      return Promise.resolve();
    },
    consumeConfirmation(scope, token) {
      const confirmation = confirmations.get(token);
      if (!confirmation || confirmation.actorId !== scope.actorId || confirmation.vaultId !== scope.vaultId) {
        return Promise.resolve({status: "missing" as const});
      }
      if (confirmation.usedAt) return Promise.resolve({status: "replayed" as const});
      const consumed = {...confirmation, usedAt: new Date().toISOString()};
      confirmations.set(token, consumed);
      return Promise.resolve({status: "ready" as const, confirmation: structuredClone(consumed)});
    }
  };
}

export function createSyntheticDocumentExtractor(result: {
  runId: string;
  fields: DocumentFieldDraft[];
  warnings?: string[];
}): DocumentExtractor {
  return {
    extract() {
      return Promise.resolve({runId: result.runId, fields: structuredClone(result.fields), warnings: [...(result.warnings ?? [])]});
    }
  };
}
