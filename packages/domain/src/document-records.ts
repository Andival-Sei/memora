import {
  documentAssetContentTypeSchema,
  documentAssetQualityStatusSchema,
  documentRecordStatusSchema,
  documentRecordTypeSchema,
  documentTypeDefinitionSchema,
  type DocumentAssetContentType,
  type DocumentAssetQualityStatus,
  type DocumentRecordStatus,
  type DocumentRecordType,
  type DocumentTypeDefinition,
  type PublicDocumentRecord,
  type PublicDocumentRecordWorkspace
} from "@memora/contracts";

export const DOCUMENT_RECORD_MAX_ASSETS = 5;
export const DOCUMENT_RECORD_MAX_ASSET_BYTES = 10 * 1024 * 1024;

const acceptedIdentityContentTypes = ["image/jpeg", "image/png", "application/pdf"] as const;
const acceptedPdfContentTypes = ["application/pdf", "image/jpeg", "image/png"] as const;

function field(
  key: string,
  labels: {ru: string; en: string},
  options: {
    dataType?: "text" | "date" | "number";
    required?: boolean;
    sensitivity?: "personal" | "identifier" | "public";
    normalizer?: "trim" | "digits" | "iso-date" | "mrz" | null;
    validator?: "non-empty" | "iso-date" | "digits" | "passport-series-number" | "mrz" | null;
  } = {}
): DocumentTypeDefinition["fields"][number] {
  return {
    key,
    label: labels,
    dataType: options.dataType ?? "text",
    required: options.required ?? false,
    sensitivity: options.sensitivity ?? "personal",
    normalizer: options.normalizer === undefined ? "trim" : options.normalizer,
    validator: options.validator === undefined ? "non-empty" : options.validator
  };
}

const rawDocumentTypeDefinitions = [
  {
    id: "ru-passport",
    schemaVersion: 1,
    label: {ru: "Паспорт РФ", en: "Russian passport"},
    acceptedContentTypes: acceptedIdentityContentTypes,
    fields: [
      field("lastName", {ru: "Фамилия", en: "Last name"}, {required: true}),
      field("firstName", {ru: "Имя", en: "First name"}, {required: true}),
      field("middleName", {ru: "Отчество", en: "Middle name"}),
      field("series", {ru: "Серия", en: "Series"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "passport-series-number"}),
      field("number", {ru: "Номер", en: "Number"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "passport-series-number"}),
      field("birthDate", {ru: "Дата рождения", en: "Date of birth"}, {required: true, dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("birthPlace", {ru: "Место рождения", en: "Place of birth"}),
      field("issueDate", {ru: "Дата выдачи", en: "Issue date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("issuedBy", {ru: "Кем выдан", en: "Issued by"}),
      field("departmentCode", {ru: "Код подразделения", en: "Department code"}, {sensitivity: "identifier", normalizer: "digits", validator: "digits"})
    ]
  },
  {
    id: "international-passport",
    schemaVersion: 1,
    label: {ru: "Заграничный паспорт", en: "International passport"},
    acceptedContentTypes: acceptedIdentityContentTypes,
    fields: [
      field("lastName", {ru: "Фамилия", en: "Last name"}, {required: true}),
      field("firstName", {ru: "Имя", en: "First name"}, {required: true}),
      field("passportNumber", {ru: "Номер паспорта", en: "Passport number"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "digits"}),
      field("nationality", {ru: "Гражданство", en: "Nationality"}),
      field("birthDate", {ru: "Дата рождения", en: "Date of birth"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("issueDate", {ru: "Дата выдачи", en: "Issue date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("expiresAt", {ru: "Срок действия", en: "Expiry date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("mrzLine1", {ru: "MRZ строка 1", en: "MRZ line 1"}, {sensitivity: "identifier", normalizer: "mrz", validator: "mrz"}),
      field("mrzLine2", {ru: "MRZ строка 2", en: "MRZ line 2"}, {sensitivity: "identifier", normalizer: "mrz", validator: "mrz"})
    ]
  },
  {
    id: "drivers-license",
    schemaVersion: 1,
    label: {ru: "Водительское удостоверение", en: "Driver's license"},
    acceptedContentTypes: acceptedIdentityContentTypes,
    fields: [
      field("lastName", {ru: "Фамилия", en: "Last name"}, {required: true}),
      field("firstName", {ru: "Имя", en: "First name"}, {required: true}),
      field("licenseNumber", {ru: "Номер удостоверения", en: "License number"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "digits"}),
      field("birthDate", {ru: "Дата рождения", en: "Date of birth"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("issueDate", {ru: "Дата выдачи", en: "Issue date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("expiresAt", {ru: "Срок действия", en: "Expiry date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("categories", {ru: "Категории", en: "Categories"})
    ]
  },
  {
    id: "tax-or-insurance",
    schemaVersion: 1,
    label: {ru: "СНИЛС или ИНН", en: "Tax or insurance document"},
    acceptedContentTypes: acceptedIdentityContentTypes,
    fields: [
      field("documentNumber", {ru: "Номер документа", en: "Document number"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "digits"}),
      field("lastName", {ru: "Фамилия", en: "Last name"}),
      field("firstName", {ru: "Имя", en: "First name"}),
      field("birthDate", {ru: "Дата рождения", en: "Date of birth"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("issueDate", {ru: "Дата выдачи", en: "Issue date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"})
    ]
  },
  {
    id: "birth-certificate",
    schemaVersion: 1,
    label: {ru: "Свидетельство о рождении", en: "Birth certificate"},
    acceptedContentTypes: acceptedIdentityContentTypes,
    fields: [
      field("series", {ru: "Серия", en: "Series"}, {sensitivity: "identifier", normalizer: "trim"}),
      field("number", {ru: "Номер", en: "Number"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "digits"}),
      field("childFullName", {ru: "ФИО ребёнка", en: "Child full name"}, {required: true}),
      field("birthDate", {ru: "Дата рождения", en: "Date of birth"}, {required: true, dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("birthPlace", {ru: "Место рождения", en: "Place of birth"}),
      field("issueDate", {ru: "Дата выдачи", en: "Issue date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("registryOffice", {ru: "Орган ЗАГС", en: "Registry office"})
    ]
  },
  {
    id: "medical-policy",
    schemaVersion: 1,
    label: {ru: "Медицинский документ", en: "Medical document"},
    acceptedContentTypes: acceptedIdentityContentTypes,
    fields: [
      field("policyNumber", {ru: "Номер полиса", en: "Policy number"}, {required: true, sensitivity: "identifier", normalizer: "digits", validator: "digits"}),
      field("lastName", {ru: "Фамилия", en: "Last name"}),
      field("firstName", {ru: "Имя", en: "First name"}),
      field("birthDate", {ru: "Дата рождения", en: "Date of birth"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("validUntil", {ru: "Действует до", en: "Valid until"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"})
    ]
  },
  {
    id: "contract",
    schemaVersion: 1,
    label: {ru: "Договор или контракт", en: "Contract"},
    acceptedContentTypes: acceptedPdfContentTypes,
    fields: [
      field("contractNumber", {ru: "Номер договора", en: "Contract number"}, {sensitivity: "identifier"}),
      field("parties", {ru: "Стороны", en: "Parties"}, {required: true}),
      field("signedAt", {ru: "Дата подписания", en: "Signed date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"}),
      field("expiresAt", {ru: "Срок действия", en: "Expiry date"}, {dataType: "date", normalizer: "iso-date", validator: "iso-date"})
    ]
  },
  {
    id: "other",
    schemaVersion: 1,
    label: {ru: "Другой документ", en: "Other document"},
    acceptedContentTypes: acceptedPdfContentTypes,
    fields: [
      field("title", {ru: "Название", en: "Title"}, {required: true, sensitivity: "public"}),
      field("notes", {ru: "Заметки", en: "Notes"}, {sensitivity: "personal"})
    ]
  }
] as const satisfies readonly DocumentTypeDefinition[];

const documentTypeDefinitions = rawDocumentTypeDefinitions.map((definition) =>
  documentTypeDefinitionSchema.parse(definition)
);

const documentTypeById = new Map(documentTypeDefinitions.map((definition) => [definition.id, definition]));

export function listDocumentTypeDefinitions(): DocumentTypeDefinition[] {
  return documentTypeDefinitions.map((definition) => structuredClone(definition));
}

export function getDocumentTypeDefinition(documentType: DocumentRecordType): DocumentTypeDefinition {
  const definition = documentTypeById.get(documentType);
  if (!definition) throw new DocumentRecordError("INVALID_DOCUMENT_TYPE");
  return structuredClone(definition);
}

export type DocumentRecordScope = {actorId: string; vaultId: string};

export interface PersistedDocumentRecord {
  id: string;
  vaultId: string;
  documentType: DocumentRecordType;
  schemaVersion: number;
  status: DocumentRecordStatus;
  title: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedDocumentAsset {
  id: string;
  recordId: string;
  vaultId: string;
  blobPath: string;
  pageIndex: number;
  contentType: DocumentAssetContentType;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  qualityStatus: DocumentAssetQualityStatus;
  createdAt: Date;
}

export interface NewDocumentRecordAsset {
  blobPath: string;
  contentType: DocumentAssetContentType;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  sha256: string;
}

export interface DocumentRecordRepository {
  createRecord(input: Omit<PersistedDocumentRecord, "createdAt" | "updatedAt">): Promise<PersistedDocumentRecord>;
  getRecord(scope: DocumentRecordScope, recordId: string): Promise<PersistedDocumentRecord | null>;
  listAssets(scope: DocumentRecordScope, recordId: string): Promise<PersistedDocumentAsset[]>;
  appendAssets(scope: DocumentRecordScope, recordId: string, assets: readonly PersistedDocumentAsset[]): Promise<void>;
}

export type DocumentRecordErrorCode =
  | "INVALID_DOCUMENT_TYPE"
  | "INVALID_RECORD"
  | "INVALID_ASSET"
  | "ASSET_LIMIT_REACHED"
  | "RECORD_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION";

const documentRecordErrorMessages: Record<DocumentRecordErrorCode, string> = {
  INVALID_DOCUMENT_TYPE: "Неизвестный тип документа.",
  INVALID_RECORD: "Реквизиты документа недействительны.",
  INVALID_ASSET: "Страница документа не прошла проверку.",
  ASSET_LIMIT_REACHED: "В одном документе может быть не более пяти страниц.",
  RECORD_NOT_FOUND: "Документ не найден.",
  INVALID_STATUS_TRANSITION: "Недопустимый переход состояния документа."
};

export class DocumentRecordError extends Error {
  constructor(readonly code: DocumentRecordErrorCode) {
    super(documentRecordErrorMessages[code]);
    this.name = "DocumentRecordError";
  }
}

const statusTransitions: Record<DocumentRecordStatus, readonly DocumentRecordStatus[]> = {
  empty: ["processing", "expired"],
  processing: ["needs_review", "failed", "expired"],
  needs_review: ["processing", "confirmed", "failed", "expired"],
  confirmed: ["needs_review", "expired"],
  failed: ["processing", "expired"],
  expired: []
};

export function transitionDocumentRecordStatus(
  from: DocumentRecordStatus,
  to: DocumentRecordStatus
): DocumentRecordStatus {
  if (!statusTransitions[from].includes(to)) throw new DocumentRecordError("INVALID_STATUS_TRANSITION");
  return to;
}

export interface DocumentRecordService {
  createRecord(scope: DocumentRecordScope, input: {
    documentType: DocumentRecordType;
    title?: string;
    issuedAt?: string | null;
    expiresAt?: string | null;
  }): Promise<PublicDocumentRecord>;
  addAssets(scope: DocumentRecordScope, input: {
    recordId: string;
    assets: readonly NewDocumentRecordAsset[];
  }): Promise<PublicDocumentRecordWorkspace>;
  getWorkspace(scope: DocumentRecordScope, recordId: string): Promise<PublicDocumentRecordWorkspace | null>;
}

function validateDate(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DocumentRecordError("INVALID_RECORD");
  }
  return value;
}

function validateAsset(asset: NewDocumentRecordAsset): void {
  if (!documentAssetContentTypeSchema.safeParse(asset.contentType).success) throw new DocumentRecordError("INVALID_ASSET");
  if (!Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0 || asset.sizeBytes > DOCUMENT_RECORD_MAX_ASSET_BYTES) {
    throw new DocumentRecordError("INVALID_ASSET");
  }
  if (!/^[a-f0-9]{64}$/.test(asset.sha256)) throw new DocumentRecordError("INVALID_ASSET");
  if (!asset.blobPath || asset.blobPath.includes("..") || asset.blobPath.startsWith("http")) {
    throw new DocumentRecordError("INVALID_ASSET");
  }
  for (const dimension of [asset.width, asset.height]) {
    if (dimension !== undefined && dimension !== null && (!Number.isSafeInteger(dimension) || dimension <= 0)) {
      throw new DocumentRecordError("INVALID_ASSET");
    }
  }
}

function toPublicRecord(record: PersistedDocumentRecord, assetCount: number): PublicDocumentRecord {
  return {
    id: record.id,
    documentType: record.documentType,
    schemaVersion: record.schemaVersion,
    status: record.status,
    title: record.title,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    assetCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toPublicWorkspace(record: PersistedDocumentRecord, assets: readonly PersistedDocumentAsset[]): PublicDocumentRecordWorkspace {
  return {
    ...toPublicRecord(record, assets.length),
    assets: assets.map((asset) => ({
      id: asset.id,
      pageIndex: asset.pageIndex,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      qualityStatus: asset.qualityStatus
    }))
  };
}

export function createDocumentRecordService(dependencies: {
  repository: DocumentRecordRepository;
  createId: (prefix: "record" | "asset") => string;
  now?: () => Date;
}): DocumentRecordService {
  const now = dependencies.now ?? (() => new Date());

  return {
    async createRecord(scope, input) {
      const documentType = documentRecordTypeSchema.safeParse(input.documentType);
      if (!documentType.success) throw new DocumentRecordError("INVALID_DOCUMENT_TYPE");
      const definition = getDocumentTypeDefinition(documentType.data);
      const title = input.title?.trim() || null;
      if (title && title.length > 200) throw new DocumentRecordError("INVALID_RECORD");
      const issuedAt = validateDate(input.issuedAt);
      const expiresAt = validateDate(input.expiresAt);
      const record = await dependencies.repository.createRecord({
        id: dependencies.createId("record"),
        vaultId: scope.vaultId,
        documentType: definition.id,
        schemaVersion: definition.schemaVersion,
        status: "empty",
        title,
        issuedAt,
        expiresAt
      });
      return toPublicRecord(record, 0);
    },

    async addAssets(scope, input) {
      const record = await dependencies.repository.getRecord(scope, input.recordId);
      if (!record) throw new DocumentRecordError("RECORD_NOT_FOUND");
      const currentAssets = await dependencies.repository.listAssets(scope, input.recordId);
      if (input.assets.length === 0) throw new DocumentRecordError("INVALID_ASSET");
      const seen = new Set(currentAssets.map((asset) => asset.sha256));
      const uniqueAssets = input.assets.filter((asset) => {
        validateAsset(asset);
        if (!asset.blobPath.startsWith(`vaults/${scope.vaultId}/`)) throw new DocumentRecordError("INVALID_ASSET");
        if (seen.has(asset.sha256)) return false;
        seen.add(asset.sha256);
        return true;
      });
      if (currentAssets.length + uniqueAssets.length > DOCUMENT_RECORD_MAX_ASSETS) {
        throw new DocumentRecordError("ASSET_LIMIT_REACHED");
      }
      const newAssets = uniqueAssets.map((asset, index) => ({
        id: dependencies.createId("asset"),
        recordId: record.id,
        vaultId: scope.vaultId,
        blobPath: asset.blobPath,
        pageIndex: currentAssets.length + index,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: asset.width ?? null,
        height: asset.height ?? null,
        sha256: asset.sha256,
        qualityStatus: "unknown" as const,
        createdAt: now()
      }));
      if (newAssets.length > 0) await dependencies.repository.appendAssets(scope, record.id, newAssets);
      const finalAssets = await dependencies.repository.listAssets(scope, record.id);
      return toPublicWorkspace(record, finalAssets.sort((left, right) => left.pageIndex - right.pageIndex));
    },

    async getWorkspace(scope, recordId) {
      const record = await dependencies.repository.getRecord(scope, recordId);
      if (!record) return null;
      const assets = await dependencies.repository.listAssets(scope, recordId);
      return toPublicWorkspace(record, assets.sort((left, right) => left.pageIndex - right.pageIndex));
    }
  };
}

export {documentAssetQualityStatusSchema, documentRecordStatusSchema};
