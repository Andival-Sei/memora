import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {readFile, realpath, stat} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {
  ApplicationError,
  createDocumentAgentUseCases,
  createInMemoryDocumentAgentStore,
  createSyntheticDocumentExtractor,
  type DocumentAgentScope,
  type DocumentAgentScopeName,
  type DocumentAgentUseCases,
  type DocumentType,
  type LocalFileReader
} from "@memora/application";

export interface CliIo {
  writeLine(line: string): void;
  writeError(line: string): void;
}

export interface CliContext {
  scope: DocumentAgentScope;
  useCases: DocumentAgentUseCases;
  startMcp?: () => Promise<void>;
}

function startLocalMcpProcess(): Promise<void> {
  const cliDirectory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = resolve(cliDirectory, "../../..");
  const tsxEntry = resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs");
  const serverEntry = resolve(repositoryRoot, "apps/mcp/src/server.ts");
  const child = spawn(process.execPath, [tsxEntry, serverEntry], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit"
  });

  return new Promise((resolveProcess, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`MCP server stopped by ${signal}.`));
      } else if (code === 0) {
        resolveProcess();
      } else {
        reject(new Error(`MCP server exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new CliUsageError(`Требуется значение для ${flag}.`);
  return value;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printValue(value: unknown, json: boolean, io: CliIo): void {
  if (json) io.writeLine(JSON.stringify(value));
  else io.writeLine(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

function printError(error: unknown, json: boolean, io: CliIo): void {
  if (error instanceof ApplicationError) {
    const payload = {error: {code: error.code, message: error.message}};
    if (json) io.writeLine(JSON.stringify(payload));
    else io.writeError(`${error.code}: ${error.message}`);
    return;
  }
  if (error instanceof CliUsageError) {
    if (json) io.writeLine(JSON.stringify({error: {code: "CLI_USAGE", message: error.message}}));
    else io.writeError(`CLI_USAGE: ${error.message}`);
    return;
  }
  const message = "Не удалось выполнить команду.";
  if (json) io.writeLine(JSON.stringify({error: {code: "CLI_FAILED", message}}));
  else io.writeError(`CLI_FAILED: ${message}`);
}

async function runDocumentCommand(args: string[], context: CliContext, io: CliIo): Promise<number> {
  const command = args[0];
  const rest = args.slice(1);
  const json = hasFlag(rest, "--json");
  if (!command) throw new CliUsageError("Укажите команду document: types, stage или inspect.");

  if (command === "types") {
    const types = await context.useCases.listTypes(context.scope);
    printValue({types}, json, io);
    return 0;
  }

  if (command === "stage") {
    const documentType = flagValue(rest, "--type");
    const localPath = flagValue(rest, "--path");
    if (!documentType) throw new CliUsageError("Для stage требуется --type.");
    if (!localPath) throw new CliUsageError("Для stage требуется --path.");
    const staged = await context.useCases.stageLocalFile(context.scope, {
      documentType: documentType as DocumentType,
      localPath,
      testFixture: hasFlag(rest, "--fixture")
    });
    if (hasFlag(rest, "--extract")) {
      const workspace = await context.useCases.runExtraction(context.scope, staged.assetHandle);
      printValue(workspace, json, io);
      return 0;
    }
    printValue(staged, json, io);
    return 0;
  }

  if (command === "inspect") {
    const recordId = flagValue(rest, "--record");
    if (!recordId) throw new CliUsageError("Для inspect требуется --record.");
    printValue(await context.useCases.getWorkspace(context.scope, recordId), json, io);
    return 0;
  }

  throw new CliUsageError(`Неизвестная команда document: ${command}.`);
}

export async function runCli(args: string[], context: CliContext, io: CliIo): Promise<number> {
  const json = hasFlag(args, "--json");
  try {
    const [group, ...rest] = args;
    if (group === "document") return await runDocumentCommand(rest, context, io);
    if (group === "mcp") {
      if (rest[0] !== "serve" || !rest.includes("--stdio") || !context.startMcp) {
        throw new CliUsageError("Используйте: memora mcp serve --stdio.");
      }
      await context.startMcp();
      return 0;
    }
    if (group === "doctor") {
      const types = await context.useCases.listTypes(context.scope);
      printValue({status: "ok", documentTypes: types.length}, json, io);
      return 0;
    }
    throw new CliUsageError("Используйте: memora doctor или memora document ...");
  } catch (error) {
    printError(error, json, io);
    return error instanceof CliUsageError ? 2 : 3;
  }
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function createNodeFileReader(): LocalFileReader {
  return {
    realpath,
    async read(localPath) {
      const [bytes, metadata] = await Promise.all([readFile(localPath), stat(localPath)]);
      return {
        filename: localPath.split(/[\\/]/).at(-1) ?? "document",
        contentType: contentTypeForFilename(localPath),
        sizeBytes: metadata.size,
        bytes: new Uint8Array(bytes)
      };
    }
  };
}

function contentTypeForFilename(localPath: string): string {
  const normalized = localPath.toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export function createDefaultCliContext(): CliContext {
  const actorId = requireEnvironment("MEMORA_ACTOR_ID");
  const vaultId = requireEnvironment("MEMORA_VAULT_ID");
  const stagingRoot = requireEnvironment("MEMORA_STAGING_ROOT");
  const scopes = new Set<DocumentAgentScopeName>([
    "documents:read",
    "documents:ingest",
    "documents:review"
  ]);
  if (process.env.MEMORA_ALLOW_CONFIRM === "1") scopes.add("documents:confirm");
  if (process.env.MEMORA_ALLOW_FIXTURES === "1") scopes.add("documents:test");

  return {
    scope: {actorId, vaultId, scopes},
    useCases: createDocumentAgentUseCases({
      stagingRoot,
      reader: createNodeFileReader(),
      store: createInMemoryDocumentAgentStore(),
      extractor: createSyntheticDocumentExtractor({
        runId: "manual-only",
        fields: [],
        warnings: ["OCR provider is not configured; document remains manual-only."]
      }),
      clock: {now: () => new Date()},
      idGenerator: (prefix) => `${prefix}-${randomUUID()}`
    }),
    startMcp: startLocalMcpProcess
  };
}

export async function main(
  args = process.argv.slice(2),
  io: CliIo = {writeLine: console.log, writeError: console.error}
): Promise<number> {
  try {
    return await runCli(args, createDefaultCliContext(), io);
  } catch {
    printError(new CliUsageError("Настройте MEMORA_ACTOR_ID, MEMORA_VAULT_ID и MEMORA_STAGING_ROOT."), hasFlag(args, "--json"), io);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
