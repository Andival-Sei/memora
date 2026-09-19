import {join, resolve} from "node:path";
import {describe, expect, it} from "vitest";
import {
  ApplicationError,
  createDocumentAgentUseCases,
  createInMemoryDocumentAgentStore,
  createSyntheticDocumentExtractor,
  type DocumentAgentScope,
  type LocalFileReader
} from "./document-agent";
import type {DocumentFixtureManifest} from "./document-fixtures";

const scope: DocumentAgentScope = {
  actorId: "actor-1",
  vaultId: "vault-1",
  scopes: new Set(["documents:read", "documents:ingest", "documents:review", "documents:confirm"])
};

const clock = {now: () => new Date("2026-09-19T12:00:00.000Z")};
const stagingRoot = resolve("memora-staging");
const stagedFilePath = join(stagingRoot, "passport.jpg");
const outsideFilePath = join(resolve("outside"), "passport.jpg");

const reader: LocalFileReader = {
  realpath(value) {
    return Promise.resolve(value);
  },
  read() {
    return Promise.resolve({
      filename: "passport.jpg",
      contentType: "image/jpeg",
      sizeBytes: 4,
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    });
  }
};

function createUseCases(store = createInMemoryDocumentAgentStore()) {
  return createDocumentAgentUseCases({
    stagingRoot,
    clock,
    reader,
    store,
    idGenerator: (() => {
      let next = 0;
      return (prefix: string) => `${prefix}-${++next}`;
    })(),
    extractor: createSyntheticDocumentExtractor({
      runId: "run-1",
      fields: [{
        key: "full_name",
        label: {ru: "ФИО", en: "Full name"},
        displayValue: "Иван Иванов",
        normalizedValue: "Иван Иванов",
        confidence: 0.98,
        evidence: [{assetId: "asset-1", page: 1}],
        reviewStatus: "proposed" as const
      }],
      warnings: []
    })
  });
}

describe("document agent application boundary", () => {
  it("rejects a capability that is not granted", async () => {
    const useCases = createUseCases();

    await expect(useCases.listTypes({
      ...scope,
      scopes: new Set(["documents:ingest"])
    })).rejects.toMatchObject({code: "MISSING_SCOPE"});
  });

  it("stages a file without returning its path or bytes", async () => {
    const useCases = createUseCases();

    const staged = await useCases.stageLocalFile(scope, {
      documentType: "ru-passport",
      localPath: stagedFilePath,
      filename: "folder\\passport.jpg"
    });

    expect(staged).toMatchObject({
      recordId: "record-1",
      documentType: "ru-passport",
      filename: "passport.jpg",
      contentType: "image/jpeg",
      sizeBytes: 4
    });
    expect(staged).not.toHaveProperty("localPath");
    expect(staged).not.toHaveProperty("bytes");
    expect(JSON.stringify(staged)).not.toContain(stagingRoot);
  });

  it("rejects a path outside the configured staging root", async () => {
    const useCases = createUseCases();

    await expect(useCases.stageLocalFile(scope, {
      documentType: "ru-passport",
      localPath: outsideFilePath
    })).rejects.toMatchObject({code: "PATH_NOT_ALLOWED"});
  });

  it("keeps extraction as review drafts and requires a single-use confirmation", async () => {
    const useCases = createUseCases();
    const staged = await useCases.stageLocalFile(scope, {
      documentType: "ru-passport",
      localPath: stagedFilePath
    });
    const workspace = await useCases.runExtraction(scope, staged.assetHandle);

    expect(workspace.status).toBe("needs_review");
    expect(workspace.canonicalFields).toEqual({});
    expect(workspace.draftFields[0]?.reviewStatus).toBe("proposed");
    await expect(useCases.runExtraction(scope, staged.assetHandle)).rejects.toMatchObject({code: "ASSET_ALREADY_USED"});

    const confirmation = await useCases.createConfirmation(scope, {
      recordId: staged.recordId,
      changes: [{key: "full_name", normalizedValue: "Иван Иванов", displayValue: "Иван Иванов"}]
    });
    expect(confirmation.changes).toHaveLength(1);

    await expect(useCases.confirmFields(scope, {
      token: confirmation.token,
      userConfirmed: false
    })).rejects.toMatchObject({code: "USER_CONFIRMATION_REQUIRED"});

    const confirmed = await useCases.confirmFields(scope, {
      token: confirmation.token,
      userConfirmed: true
    });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.canonicalFields).toEqual({full_name: "Иван Иванов"});

    await expect(useCases.confirmFields(scope, {
      token: confirmation.token,
      userConfirmed: true
    })).rejects.toMatchObject({code: "TOKEN_REPLAYED"});
  });

  it("binds a confirmation to its exact field payload", async () => {
    const store = createInMemoryDocumentAgentStore();
    const consumeConfirmation = store.consumeConfirmation.bind(store);
    store.consumeConfirmation = async (currentScope, token) => {
      const result = await consumeConfirmation(currentScope, token);
      if (result.status !== "ready" || !result.confirmation) return result;
      return {
        status: "ready" as const,
        confirmation: {
          ...result.confirmation,
          changes: [{key: "full_name", normalizedValue: "Другой человек", displayValue: "Другой человек"}]
        }
      };
    };
    const useCases = createUseCases(store);
    const staged = await useCases.stageLocalFile(scope, {
      documentType: "ru-passport",
      localPath: stagedFilePath
    });
    await useCases.runExtraction(scope, staged.assetHandle);
    const confirmation = await useCases.createConfirmation(scope, {
      recordId: staged.recordId,
      changes: [{key: "full_name", normalizedValue: "Иван Иванов", displayValue: "Иван Иванов"}]
    });

    await expect(useCases.confirmFields(scope, {
      token: confirmation.token,
      userConfirmed: true
    })).rejects.toMatchObject({code: "PAYLOAD_MISMATCH"});
  });

  it("does not let another vault read a record", async () => {
    const useCases = createUseCases();
    const staged = await useCases.stageLocalFile(scope, {
      documentType: "ru-passport",
      localPath: stagedFilePath
    });

    await expect(useCases.getWorkspace({
      ...scope,
      vaultId: "vault-2"
    }, staged.recordId)).rejects.toBeInstanceOf(ApplicationError);
  });

  it("allows fixture verification only with the test capability", async () => {
    const useCases = createUseCases();
    const manifest: DocumentFixtureManifest = {
      fixtureId: "redacted-001",
      documentType: "other",
      fields: [{key: "title", expected: "Synthetic value"}]
    };
    const actualFields = [{key: "title", displayValue: "Synthetic value", normalizedValue: "Synthetic value", confidence: 0.9}];

    await expect(useCases.verifyFixture(scope, {manifest, actualFields})).rejects.toMatchObject({code: "MISSING_SCOPE"});
    const result = await useCases.verifyFixture({
      ...scope,
      scopes: new Set([...scope.scopes, "documents:test"])
    }, {manifest, actualFields});
    expect(result.summary).toMatchObject({matchedCount: 1, missingCount: 0, extraCount: 0});
  });
});
