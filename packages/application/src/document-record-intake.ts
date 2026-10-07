import {
  DOCUMENT_RECORD_MAX_ASSETS,
  DOCUMENT_RECORD_MAX_ASSET_BYTES,
  DocumentRecordError,
  getDocumentTypeDefinition,
  type DocumentRecordScope,
  type DocumentRecordService,
  type NewDocumentRecordAsset
} from "@memora/domain";
import type {
  DocumentAssetContentType,
  DocumentRecordType,
  PublicDocumentRecord,
  PublicDocumentRecordWorkspace
} from "@memora/contracts";

export interface PersonalVaultResolver {
  ensurePersonalVault(clerkId: string): Promise<{vaultId: string}>;
}

export interface DocumentRecordUploadTicket {
  pathname: string;
  contentType: DocumentAssetContentType;
  maximumSizeInBytes: number;
}

export interface PrivateAssetReference {
  pathname: string;
  contentType: DocumentAssetContentType;
  sizeBytes: number;
}

export interface DocumentRecordIntake {
  list(actorId: string): Promise<PublicDocumentRecord[]>;
  create(actorId: string, input: {documentType: DocumentRecordType; title?: string}): Promise<PublicDocumentRecord>;
  getWorkspace(actorId: string, recordId: string): Promise<PublicDocumentRecordWorkspace | null>;
  createUploadTicket(actorId: string, recordId: string, contentType: DocumentAssetContentType): Promise<DocumentRecordUploadTicket>;
  authorizeUpload(actorId: string, recordId: string, pathname: string, contentType: DocumentAssetContentType): Promise<void>;
  completeUpload(actorId: string, recordId: string, asset: NewDocumentRecordAsset): Promise<{
    workspace: PublicDocumentRecordWorkspace;
    duplicate: boolean;
    retainedPath: boolean;
  }>;
  getPrivateAsset(actorId: string, recordId: string, assetId: string): Promise<PrivateAssetReference | null>;
}

const typeExtensions: Record<DocumentAssetContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf"
};

const safePathSegment = /^[a-zA-Z0-9_-]{1,80}$/;

function getScope(actorId: string, vaultId: string): DocumentRecordScope {
  if (!actorId || !safePathSegment.test(vaultId)) throw new DocumentRecordError("INVALID_ASSET");
  return {actorId, vaultId};
}

function getTicketAssetId(scope: DocumentRecordScope, recordId: string, pathname: string, contentType: DocumentAssetContentType): string {
  const prefix = `vaults/${scope.vaultId}/document-records/${recordId}/`;
  if (!safePathSegment.test(recordId) || !pathname.startsWith(prefix)) throw new DocumentRecordError("INVALID_ASSET");
  const filename = pathname.slice(prefix.length);
  const extension = typeExtensions[contentType];
  const expectedSuffix = `.${extension}`;
  if (!filename.endsWith(expectedSuffix)) throw new DocumentRecordError("INVALID_ASSET");
  const assetId = filename.slice(0, -expectedSuffix.length);
  if (!safePathSegment.test(assetId)) throw new DocumentRecordError("INVALID_ASSET");
  return assetId;
}

function assertTypeAllowed(documentType: DocumentRecordType, contentType: DocumentAssetContentType): void {
  const definition = getDocumentTypeDefinition(documentType);
  if (!definition.acceptedContentTypes.includes(contentType)) throw new DocumentRecordError("INVALID_ASSET");
}

export function createDocumentRecordIntake(dependencies: {
  records: DocumentRecordService;
  personalVaults: PersonalVaultResolver;
  createId: () => string;
}): DocumentRecordIntake {
  async function scopeFor(actorId: string): Promise<DocumentRecordScope> {
    if (!actorId) throw new DocumentRecordError("RECORD_NOT_FOUND");
    const {vaultId} = await dependencies.personalVaults.ensurePersonalVault(actorId);
    return getScope(actorId, vaultId);
  }

  async function ownedWorkspace(scope: DocumentRecordScope, recordId: string): Promise<PublicDocumentRecordWorkspace> {
    const workspace = await dependencies.records.getWorkspace(scope, recordId);
    if (!workspace) throw new DocumentRecordError("RECORD_NOT_FOUND");
    return workspace;
  }

  return {
    async list(actorId) {
      return dependencies.records.listRecords(await scopeFor(actorId));
    },

    async create(actorId, input) {
      return dependencies.records.createRecord(await scopeFor(actorId), input);
    },

    async getWorkspace(actorId, recordId) {
      return dependencies.records.getWorkspace(await scopeFor(actorId), recordId);
    },

    async createUploadTicket(actorId, recordId, contentType) {
      const scope = await scopeFor(actorId);
      const workspace = await ownedWorkspace(scope, recordId);
      if (workspace.assetCount >= DOCUMENT_RECORD_MAX_ASSETS) throw new DocumentRecordError("ASSET_LIMIT_REACHED");
      assertTypeAllowed(workspace.documentType, contentType);

      const assetId = dependencies.createId();
      if (!safePathSegment.test(assetId)) throw new DocumentRecordError("INVALID_ASSET");
      return {
        pathname: `vaults/${scope.vaultId}/document-records/${recordId}/${assetId}.${typeExtensions[contentType]}`,
        contentType,
        maximumSizeInBytes: DOCUMENT_RECORD_MAX_ASSET_BYTES
      };
    },

    async authorizeUpload(actorId, recordId, pathname, contentType) {
      const scope = await scopeFor(actorId);
      const workspace = await ownedWorkspace(scope, recordId);
      if (workspace.assetCount >= DOCUMENT_RECORD_MAX_ASSETS) throw new DocumentRecordError("ASSET_LIMIT_REACHED");
      assertTypeAllowed(workspace.documentType, contentType);
      getTicketAssetId(scope, recordId, pathname, contentType);
    },

    async completeUpload(actorId, recordId, asset) {
      const scope = await scopeFor(actorId);
      const workspaceBefore = await ownedWorkspace(scope, recordId);
      assertTypeAllowed(workspaceBefore.documentType, asset.contentType);
      getTicketAssetId(scope, recordId, asset.blobPath, asset.contentType);

      const retainedPath = await dependencies.records.hasAssetPath(scope, recordId, asset.blobPath);
      const workspace = await dependencies.records.addAssets(scope, {recordId, assets: [asset]});
      return {
        workspace,
        duplicate: workspace.assetCount === workspaceBefore.assetCount,
        retainedPath
      };
    },

    async getPrivateAsset(actorId, recordId, assetId) {
      const scope = await scopeFor(actorId);
      const workspace = await dependencies.records.getWorkspace(scope, recordId);
      if (!workspace || !workspace.assets.some((asset) => asset.id === assetId)) return null;
      const asset = await dependencies.records.getPersistedAsset(scope, recordId, assetId);
      if (!asset) return null;
      return {pathname: asset.blobPath, contentType: asset.contentType, sizeBytes: asset.sizeBytes};
    }
  };
}
