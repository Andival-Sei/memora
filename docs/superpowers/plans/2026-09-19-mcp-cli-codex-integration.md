# MCP/CLI интеграция Memora с Codex и ChatGPT — план реализации

> **Для агентных исполнителей:** REQUIRED SUB-SKILL: использовать `superpowers:executing-plans` (или `superpowers:subagent-driven-development`) и выполнять задачи по одной с TDD и отдельной проверкой.

**Цель:** дать Codex/ChatGPT безопасный, проверяемый путь от явно выбранного файла документа до field-level review через общий application-контракт Memora.

**Архитектура:** `packages/application` владеет use cases, scopes, confirmation и безопасным DTO. `apps/cli` и `apps/mcp` — тонкие transports. Сначала поставляется локальный STDIO MCP и fixture/eval контур; remote Streamable HTTP MCP подключается после auth/tunnel и provider gates.

**Стек:** TypeScript  strict, Zod v4, Node 24, `@modelcontextprotocol/sdk` TypeScript SDK, npm workspaces/Turborepo, Vitest, существующие Clerk/Neon/private Blob adapters.

**Спецификация:** `docs/superpowers/specs/2026-09-19-mcp-cli-codex-integration.md`

## Глобальные ограничения

- Web, CLI и MCP вызывают application use cases, а не DB/Blob напрямую.
- Scope всегда содержит `actorId`, `vaultId` и минимальный набор capabilities.
- Локальный файл читается только внутри явно заданного staging root.
- MCP не возвращает raw bytes, абсолютный путь, private URL, секрет или полный provider payload.
- OCR/extraction создаёт draft; canonical fields меняются только через одноразовый confirmation token.
- Реальный provider-specific код запрещён до provisioned provider, privacy review и benchmark gate.
- Прямые коммиты в `main`, русский Conventional Commit, без PR и force-push.

## Review focus

1. Path traversal и symlink за пределами staging root — тест Task 2.
2. Cross-vault record/handle — отрицательный permission test Task 1.
3. Повторное использование или подмена confirmation token — тест Task 1.
4. Prompt injection в fixture/OCR text — redaction/instruction-isolation test Task 4.
5. Различие local STDIO и web remote connection — transport smoke/docs test Task 3.

## Task packet: общий контракт и capability boundary

- Goal: вынести transport-independent DTO/use-case boundary для document agent workflows.
- Class: architectural, Tier A.
- Spec: этот plan и `docs/superpowers/specs/2026-09-19-mcp-cli-codex-integration.md`.
- Plan task: Task 1.
- Owner module: `packages/application`.
- Allowed files:
  - `packages/application/package.json`
  - `packages/application/tsconfig.json`
  - `packages/application/src/index.ts`
  - `packages/application/src/document-agent.ts`
  - `packages/application/src/document-agent.test.ts`
  - `package.json`
  - `package-lock.json`
  - `turbo.json`
  - этот spec и plan
- Out of scope: database migration, OCR provider, UI, remote auth, real PII.
- Acceptance: schemas reject missing scopes; confirmation token is single-use and payload-bound; DTOs contain no raw bytes/path/private URL.
- RED: `npm run test --workspace=@memora/application` fails because module is absent.
- GREEN: same command passes with scope, draft, confirmation and redaction tests.
- Commit: `feat(application): определить безопасный контракт агента документов`.

### Task 1: application contract and in-memory verification boundary

**Files:** create the allowed files above.

**Interfaces:**

- `DocumentAgentUseCases.listTypes(scope)`
- `DocumentAgentUseCases.stageLocalFile(scope, input)`
- `DocumentAgentUseCases.getWorkspace(scope, recordId)`
- `DocumentAgentUseCases.runExtraction(scope, assetHandle)`
- `DocumentAgentUseCases.createConfirmation(scope, input)`
- `DocumentAgentUseCases.confirmFields(scope, input: {token: string; userConfirmed: boolean})`
- `createDocumentAgentUseCases(dependencies)` accepts `LocalFileReader`, `DocumentAgentStore`, `Clock`, and `IdGenerator` ports.

- [ ] Step 1: write tests for missing capability, cross-vault read, opaque output, draft-only extraction, token replay and payload mismatch.
- [ ] Step 2: run `npm run test --workspace=@memora/application`; expected RED: cannot resolve the new workspace/package.
- [ ] Step 3: add package/workspace wiring and the smallest Zod/domain DTOs.
- [ ] Step 4: run the targeted suite; expected GREEN with the named assertions.
- [ ] Step 5: run `npm run lint --workspace=@memora/application`, `npm run typecheck --workspace=@memora/application`.
- [ ] Step 6: commit only Task 1 files with `git diff --cached --check`.

### Task 2: secure CLI staging and document commands

**Files:**

- Create `apps/cli/package.json`, `apps/cli/tsconfig.json`, `apps/cli/src/main.ts`, `apps/cli/src/cli.test.ts`.
- Modify root `package.json`, `turbo.json`, lockfile.
- Do not modify provider adapters or Web routes.

**Interfaces:**

- `memora document stage --type <type> --path <file> [--fixture] [--json]`
- `memora document types [--json]`
- `memora document inspect --record <id>`
- `memora document verify-fixture --fixture <id> [--json]`
- `memora mcp serve --stdio`

The first local CLI composition uses a process-local store and a manual-only
extractor. Persistent inspect/verify and real OCR are enabled only when the
database-backed record adapter and provider gates are completed; the command
never pretends that an unprovisioned OCR provider populated fields.

- [ ] Step 1: RED test for outside-root path and stable exit code 2.
- [ ] Step 2: RED test for stage output not containing absolute path or bytes.
- [ ] Step 3: implement argv parser and use-case adapter; no business rules in command files.
- [ ] Step 4: GREEN targeted CLI suite and `npm exec memora -- doctor`.
- [ ] Step 5: run CLI lint/typecheck/full tests.
- [ ] Step 6: commit `feat(cli): добавить безопасные команды документов`.

### Task 3: local STDIO MCP server

**Files:**

- Create `apps/mcp/package.json`, `apps/mcp/tsconfig.json`, `apps/mcp/src/server.ts`, `apps/mcp/src/tools.ts`, `apps/mcp/src/resources.ts`, `apps/mcp/src/mcp.test.ts`, `apps/mcp/README.md`.
- Modify root package/lockfile and `.codex/config.example.toml`.
- Create `docs/integrations/codex-chatgpt-mcp.md` with the verified local setup and the remote/web limitation.

**Interfaces:**

- MCP server name `memora`, stable version `0.1.0`.
- Tools: `memora_document_list_types`, `memora_document_stage_local_file`, `memora_document_get_workspace`, `memora_document_run_extraction`, `memora_document_create_confirmation`, `memora_document_confirm_fields`, `memora_document_verify_fixture`.
- Resources: `memora://document-types`, `memora://document-record/{recordId}`, `memora://document-run/{runId}/evidence`.

- [ ] Step 1: RED initialize/list-tools test and invalid-schema test.
- [ ] Step 2: RED permission/approval annotation test for read vs write tools.
- [ ] Step 3: implement stdio server with `@modelcontextprotocol/sdk`, server instructions, Zod schemas and application dependency injection.
- [ ] Step 4: GREEN unit/contract tests and `npx @modelcontextprotocol/inspector` manual smoke against the local server.
- [ ] Step 5: verify output redaction and no logs to stdout besides protocol frames.
- [ ] Step 6: commit `feat(mcp): добавить локальный MCP сервер Memora`.

### Task 4: fixture/eval harness for field mapping and injection isolation

**Files:**

- Create `packages/application/src/document-fixtures.ts`, `packages/application/src/document-fixtures.test.ts`, `docs/ai/DOCUMENT_MCP_EVALS.md`, `fixtures/documents/.gitkeep`.
- Modify Task 1 exports only.

**Interfaces:**

- fixture manifest contains `fixtureId`, `documentType`, expected field keys and redacted synthetic values; original images are never committed.
- verifier returns per-field `expected`, `actual`, `match`, `confidence`, `reason` and aggregate counts.

- [ ] Step 1: RED test for missing/extra field, normalized date/number, and embedded instruction text treated as data.
- [ ] Step 2: implement deterministic verifier without model/provider calls.
- [ ] Step 3: GREEN and record baseline metrics; no real passport data.
- [ ] Step 4: document how a user-approved redacted fixture is added and removed.
- [ ] Step 5: commit `test(ai): добавить eval-контур полей документов`.

### Task 5: remote MCP/tunnel and ChatGPT connection

**Gate before code:** provider/auth credentials, hosting URL, OAuth/tunnel choice, rate limits and retention must be explicitly configured; no production secret in git.

**Files:**

- Create `apps/web/src/app/api/mcp/route.ts`, `apps/web/src/lib/mcp/remote-auth.ts`, `docs/integrations/codex-chatgpt-mcp.md`, remote transport tests.
- Modify Vercel/environment docs only after deployment target is approved.

**Interfaces:**

- Streamable HTTP `/api/mcp`, OAuth 2.1 or short-lived bearer token, `401/403` without leaking record existence.
- upload flow issues one-time `stagedAssetHandle`; remote MCP never accepts arbitrary local path.

- [ ] Step 1: RED HTTP transport/auth tests.
- [ ] Step 2: implement only after auth/tunnel/provider gates pass.
- [ ] Step 3: run MCP Inspector, auth negative tests, signed-in upload/review smoke and Vercel production smoke.
- [ ] Step 4: document desktop/Codex STDIO and web ChatGPT remote setup, including plan availability/limitations.
- [ ] Step 5: commit `feat(mcp): подключить удалённый MCP endpoint`.

## Full verification per task

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ai-governance.ps1
npm audit --omit=dev --audit-level=high
git diff --check
```

API/CLI/MCP tasks additionally require schema tests, auth positive/negative
tests, transport smoke and MCP Inspector. Tasks changing UI additionally use
desktop/mobile RU/EN theme, keyboard, axe and reduced-motion browser checks.

## Rollback

Each task is one revertible commit. Roll back with `git revert <commit>`, then
rerun the full verification and confirm that the previous Web document upload
contract remains intact. Never delete private assets as part of a code rollback.
