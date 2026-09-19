import {describe, expect, it} from "vitest";
import {ApplicationError, type DocumentAgentScope, type DocumentAgentUseCases} from "@memora/application";
import {runCli, type CliIo} from "./main";

const scope: DocumentAgentScope = {
  actorId: "local-codex",
  vaultId: "vault-1",
  scopes: new Set(["documents:read", "documents:ingest", "documents:review", "documents:test"])
};

function createIo() {
  const output: string[] = [];
  const errors: string[] = [];
  const io: CliIo = {
    writeLine: (line) => output.push(line),
    writeError: (line) => errors.push(line)
  };
  return {io, output, errors};
}

const baseUseCases: DocumentAgentUseCases = {
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
  runExtraction: () => baseUseCases.getWorkspace(scope, "record-1"),
  createConfirmation: () => Promise.resolve({token: "token-1", recordId: "record-1", changes: [], expiresAt: "2026-09-19T12:15:00.000Z"}),
  confirmFields: () => baseUseCases.getWorkspace(scope, "record-1")
};

describe("memora CLI", () => {
  it("prints a safe JSON stage result without the source path", async () => {
    const {io, output} = createIo();
    const exitCode = await runCli(["document", "stage", "--type", "ru-passport", "--path", "C:\\private\\passport.jpg", "--json"], {
      scope,
      useCases: baseUseCases
    }, io);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output.join(""))).toMatchObject({assetHandle: "handle-1", recordId: "record-1"});
    expect(output.join("\n")).not.toContain("C:\\private\\passport.jpg");
  });

  it("maps application permission errors to a stable non-zero exit code", async () => {
    const {io, output, errors} = createIo();
    const useCases: DocumentAgentUseCases = {
      ...baseUseCases,
      stageLocalFile: () => Promise.reject(new ApplicationError("PATH_NOT_ALLOWED"))
    };

    const exitCode = await runCli(["document", "stage", "--type", "ru-passport", "--path", "C:\\outside\\passport.jpg", "--json"], {
      scope,
      useCases
    }, io);

    expect(exitCode).toBe(3);
    expect(output.join("\n") + errors.join("\n")).toContain("PATH_NOT_ALLOWED");
    expect(output.join("\n") + errors.join("\n")).not.toContain("C:\\outside\\passport.jpg");
  });

  it("rejects missing command arguments before calling a use case", async () => {
    const {io, errors} = createIo();
    const exitCode = await runCli(["document", "stage", "--type", "ru-passport"], {
      scope,
      useCases: baseUseCases
    }, io);

    expect(exitCode).toBe(2);
    expect(errors.join("\n")).toContain("--path");
  });

  it("starts the local MCP transport through the CLI", async () => {
    const {io, output} = createIo();
    let started = false;
    const exitCode = await runCli(["mcp", "serve", "--stdio", "--json"], {
      scope,
      useCases: baseUseCases,
      startMcp: () => {
        started = true;
        return Promise.resolve();
      }
    }, io);

    expect(exitCode).toBe(0);
    expect(started).toBe(true);
    expect(output).toHaveLength(0);
  });
});
