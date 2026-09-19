import {z} from "zod";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ApplicationError,
  type DocumentAgentScope,
  type DocumentAgentUseCases,
  type DocumentWorkspace
} from "@memora/application";

export interface MemoraMcpDependencies {
  scope: DocumentAgentScope;
  useCases: DocumentAgentUseCases;
}

function jsonResult(value: unknown) {
  return {
    content: [{type: "text" as const, text: JSON.stringify(value)}]
  };
}

function permissionFilteredWorkspace(workspace: DocumentWorkspace) {
  const {vaultId, ...filtered} = workspace;
  void vaultId;
  return filtered;
}

async function safely<T>(operation: () => Promise<T>) {
  try {
    return jsonResult(await operation());
  } catch (error) {
    if (error instanceof ApplicationError) {
      return {isError: true, ...jsonResult({error: {code: error.code, message: error.message}})};
    }
    return {isError: true, ...jsonResult({error: {code: "MCP_FAILED", message: "Не удалось выполнить операцию."}})};
  }
}

const confirmationChangeSchema = z.object({
  key: z.string().min(1).max(120),
  normalizedValue: z.string().max(1000).nullable(),
  displayValue: z.string().max(1000).nullable()
});

export function registerMemoraTools(server: McpServer, dependencies: MemoraMcpDependencies): void {
  const {scope, useCases} = dependencies;

  server.registerTool("memora_document_list_types", {
    title: "List Memora document types",
    description: "Return versioned document types and field schemas without private records.",
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true}
  }, async () => safely(() => useCases.listTypes(scope)));

  server.registerTool("memora_document_stage_local_file", {
    title: "Stage a local document asset",
    description: "Stage one explicitly selected file inside the configured Memora staging root. The path and bytes are never returned.",
    inputSchema: {
      documentType: z.string().min(1),
      localPath: z.string().min(1),
      testFixture: z.boolean().optional()
    },
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false}
  }, async ({documentType, localPath, testFixture}) => safely(() => useCases.stageLocalFile(scope, {
    documentType: documentType as Parameters<DocumentAgentUseCases["stageLocalFile"]>[1]["documentType"],
    localPath,
    ...(testFixture === undefined ? {} : {testFixture})
  })));

  server.registerTool("memora_document_get_workspace", {
    title: "Get a Memora document workspace",
    description: "Return the permission-filtered document status, assets and field drafts for one record.",
    inputSchema: {recordId: z.string().min(1)},
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true}
  }, async ({recordId}) => safely(async () => permissionFilteredWorkspace(await useCases.getWorkspace(scope, recordId))));

  server.registerTool("memora_document_run_extraction", {
    title: "Run document extraction",
    description: "Consume one staged handle and return review drafts. This never writes canonical fields.",
    inputSchema: {assetHandle: z.string().min(1)},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false}
  }, async ({assetHandle}) => safely(async () => permissionFilteredWorkspace(await useCases.runExtraction(scope, assetHandle))));

  server.registerTool("memora_document_create_confirmation", {
    title: "Create a document confirmation diff",
    description: "Create a short-lived, payload-bound confirmation token without changing canonical fields.",
    inputSchema: {
      recordId: z.string().min(1),
      changes: z.array(confirmationChangeSchema).min(1).max(100)
    },
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false}
  }, async ({recordId, changes}) => safely(() => useCases.createConfirmation(scope, {
    recordId,
    changes
  })));

  server.registerTool("memora_document_confirm_fields", {
    title: "Confirm document fields",
    description: "Apply a previously reviewed field diff only after explicit user confirmation.",
    inputSchema: {
      token: z.string().min(1),
      userConfirmed: z.literal(true)
    },
    annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: false}
  }, async ({token, userConfirmed}) => safely(async () => permissionFilteredWorkspace(await useCases.confirmFields(scope, {token, userConfirmed}))));
}
