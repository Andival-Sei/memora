import {describe, expect, it} from "vitest";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {ApplicationError, type DocumentAgentScope, type DocumentAgentUseCases} from "@memora/application";
import {createMemoraMcpServer} from "./server";

const scope: DocumentAgentScope = {
  actorId: "codex",
  vaultId: "vault-1",
  scopes: new Set(["documents:read", "documents:ingest", "documents:review"])
};

const useCases: DocumentAgentUseCases = {
  listTypes: () => Promise.resolve([{
    id: "ru-passport",
    schemaVersion: 1,
    label: {ru: "Паспорт РФ", en: "Russian passport"},
    acceptedContentTypes: ["image/jpeg"],
    fields: []
  }]),
  stageLocalFile: () => Promise.resolve({
    assetHandle: "handle-1",
    recordId: "record-1",
    documentType: "ru-passport",
    filename: "passport.jpg",
    contentType: "image/jpeg",
    sizeBytes: 4,
    expiresAt: "2026-09-19T12:15:00.000Z"
  }),
  getWorkspace: () => Promise.resolve({
    recordId: "record-1",
    vaultId: "vault-1",
    documentType: "ru-passport",
    status: "staged",
    assets: [],
    draftFields: [],
    canonicalFields: {},
    warnings: []
  }),
  runExtraction: () => Promise.resolve({
    recordId: "record-1",
    vaultId: "vault-1",
    documentType: "ru-passport",
    status: "needs_review",
    assets: [],
    draftFields: [],
    canonicalFields: {},
    warnings: ["manual-only"]
  }),
  createConfirmation: () => Promise.reject(new ApplicationError("MISSING_SCOPE")),
  confirmFields: () => Promise.reject(new ApplicationError("MISSING_SCOPE")),
  verifyFixture: (currentScope) => currentScope.scopes.has("documents:test")
    ? Promise.resolve({
      fixtureId: "fixture-1",
      documentType: "other" as const,
      fields: [],
      summary: {expectedCount: 0, actualCount: 0, matchedCount: 0, missingCount: 0, extraCount: 0, mismatchedCount: 0}
    })
    : Promise.reject(new ApplicationError("MISSING_SCOPE"))
};

async function connectTestServer(currentScope = scope) {
  const server = createMemoraMcpServer({scope: currentScope, useCases});
  const client = new Client({name: "memora-test-client", version: "0.1.0"});
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {client, server};
}

describe("Memora MCP server", () => {
  it("exposes only the reviewed tool surface with read/write annotations", async () => {
    const {client} = await connectTestServer();
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining([
      "memora_document_list_types",
      "memora_document_stage_local_file",
      "memora_document_get_workspace",
      "memora_document_run_extraction",
      "memora_document_verify_fixture",
      "memora_document_confirm_fields"
    ]));
    const confirm = listed.tools.find((tool) => tool.name === "memora_document_confirm_fields");
    expect(confirm?.annotations).toMatchObject({readOnlyHint: false, destructiveHint: true});
  });

  it("validates tool input and never returns the source path", async () => {
    const {client} = await connectTestServer();
    const invalid = await client.callTool({
      name: "memora_document_stage_local_file",
      arguments: {documentType: "ru-passport"}
    });
    expect(invalid).toMatchObject({isError: true});

    const result = await client.callTool({
      name: "memora_document_stage_local_file",
      arguments: {documentType: "ru-passport", localPath: "C:\\private\\passport.jpg"}
    });
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("handle-1");
    expect(serialized).not.toContain("C:\\private\\passport.jpg");
  });

  it("keeps fixture verification behind the test scope", async () => {
    const input = {
      manifest: {fixtureId: "fixture-1", documentType: "other", fields: [{key: "title", expected: "Synthetic"}]},
      actualFields: [{key: "title", displayValue: "Synthetic", normalizedValue: "Synthetic", confidence: 0.9}]
    };
    const denied = await (await connectTestServer()).client.callTool({
      name: "memora_document_verify_fixture",
      arguments: input
    });
    expect(denied).toMatchObject({isError: true});
    expect(JSON.stringify(denied)).toContain("MISSING_SCOPE");

    const fixtureScope: DocumentAgentScope = {
      ...scope,
      scopes: new Set([...scope.scopes, "documents:test"])
    };
    const allowed = await (await connectTestServer(fixtureScope)).client.callTool({
      name: "memora_document_verify_fixture",
      arguments: input
    });
    expect(JSON.stringify(allowed)).toContain("fixture-1");
  });
});
