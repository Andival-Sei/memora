import {McpServer, ResourceTemplate} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {DocumentWorkspace} from "@memora/application";
import type {MemoraMcpDependencies} from "./tools";

function permissionFilteredWorkspace(workspace: DocumentWorkspace) {
  const {vaultId, ...filtered} = workspace;
  void vaultId;
  return filtered;
}

export function registerMemoraResources(server: McpServer, dependencies: MemoraMcpDependencies): void {
  const {scope, useCases} = dependencies;

  server.registerResource("memora-document-types", "memora://document-types", {
    title: "Memora document type schemas",
    description: "Public versioned document schemas without personal data.",
    mimeType: "application/json"
  }, async (uri) => ({contents: [{uri: uri.href, mimeType: "application/json", text: JSON.stringify(await useCases.listTypes(scope))}]}));

  server.registerResource("memora-document-record", new ResourceTemplate("memora://document-record/{recordId}", {list: undefined}), {
    title: "Memora document workspace",
    description: "Permission-filtered status and field drafts for one document record.",
    mimeType: "application/json"
  }, async (uri, variables) => {
    const recordId = variables.recordId;
    if (typeof recordId !== "string") {
      return {contents: [{uri: uri.href, mimeType: "application/json", text: JSON.stringify({error: {code: "INVALID_RESOURCE"}})}]};
    }
    try {
      const workspace = permissionFilteredWorkspace(await useCases.getWorkspace(scope, recordId));
      return {contents: [{uri: uri.href, mimeType: "application/json", text: JSON.stringify(workspace)}]};
    } catch {
      return {contents: [{uri: uri.href, mimeType: "application/json", text: JSON.stringify({error: {code: "RECORD_NOT_FOUND", message: "Документ не найден."}})}]};
    }
  });
}
