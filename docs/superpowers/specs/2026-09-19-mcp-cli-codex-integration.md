# MCP/CLI интеграция Memora с Codex и ChatGPT — спецификация

## Цель

Memora должна предоставлять один application-контракт для Web, CLI и MCP,
чтобы Codex/ChatGPT могли безопасно загрузить явно выбранный файл документа,
запустить распознавание и проверить заполнение полей. MCP не получает обходной
доступ к базе или файловой системе: каждый вызов проходит тот же owner/vault
scope, валидацию и audit, что и Web.

## Реальность подключения клиентов

- **Codex CLI, IDE и desktop ChatGPT:** поддерживается локальный STDIO MCP.
  Команда запускается на компьютере пользователя, а конфигурация Codex
  шарится между этими клиентами.
- **ChatGPT в браузере:** локальный STDIO не видит. Нужен удалённый
  Streamable HTTP endpoint с OAuth/токеном либо Secure MCP Tunnel для закрытого
  локального сервера.
- **Plugin/App:** первый релиз реализует стандартный MCP server. UI Apps SDK
  добавляется после стабилизации tool-контракта и не дублирует application
  логику.

Подключение не означает разрешение на чтение произвольных файлов. Для локального
режима пользователь явно задаёт staging root; для web-режима файл сначала
попадает в приватный upload flow Memora и передаётся MCP как одноразовый opaque
handle.

## Канонический workflow

```text
explicit file selection
  -> stage asset (private, validated, expiring handle)
  -> create/resolve typed document record
  -> quality + OCR/extraction run
  -> field drafts with confidence/evidence
  -> assistant reports diff and asks for confirmation
  -> user confirms
  -> canonical fields + audit event
```

OCR/extraction никогда не пишет подтверждённые поля напрямую. Инструкции,
найденные внутри изображения, PDF, OCR или tool output, считаются недоверенными
данными и не меняют полномочия агента.

## Общий application-контракт

Transport-слои не знают Drizzle, Clerk, Blob, Next.js или MCP SDK. Они вызывают
use cases из `packages/application`.

```ts
type MemoraScope = {
  actorId: string;
  vaultId: string;
  scopes: ReadonlySet<
    "documents:read" | "documents:ingest" | "documents:review" |
    "documents:confirm" | "documents:test"
  >;
};

type StageLocalFileInput = {
  documentType: string;
  localPath: string;
  filename?: string;
  testFixture?: boolean;
};

type StagedAsset = {
  assetHandle: string; // opaque, single-use, expiring
  recordId: string;
  documentType: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: string;
};

type FieldDraft = {
  key: string;
  label: {ru: string; en: string};
  displayValue: string | null;
  normalizedValue: string | null;
  confidence: number | null;
  evidence: Array<{
    assetId: string;
    page: number;
    boundingBox?: {left: number; top: number; width: number; height: number};
  }>;
  reviewStatus: "proposed" | "accepted" | "rejected" | "needs_review";
};

interface DocumentAgentUseCases {
  listTypes(scope: MemoraScope): Promise<DocumentTypeSummary[]>;
  stageLocalFile(scope: MemoraScope, input: StageLocalFileInput):
    Promise<StagedAsset>;
  getWorkspace(scope: MemoraScope, recordId: string):
    Promise<DocumentWorkspace>;
  runExtraction(scope: MemoraScope, assetHandle: string):
    Promise<DocumentWorkspace>;
  createConfirmation(scope: MemoraScope, input: ConfirmationRequest):
    Promise<ConfirmationDraft>;
  confirmFields(scope: MemoraScope, input: {token: string; userConfirmed: boolean}):
    Promise<DocumentWorkspace>;
  verifyFixture(scope: MemoraScope, input: {
    manifest: DocumentFixtureManifest;
    actualFields: DocumentFixtureActualField[];
  }): Promise<DocumentFixtureVerificationResult>;
}
```

`stageLocalFile` является только локальным transport capability и разрешает
пути внутри настроенного staging root. Удалённый MCP использует эквивалентный
`stageUploadedAsset`, который принимает server-issued upload handle; raw bytes,
абсолютный путь, Blob URL и provider token в результат не попадают.

## MCP tools и resources

### Read-only tools

- `memora_document_list_types` — versioned field schemas и поддерживаемые
  форматы без персональных данных.
- `memora_document_get_workspace` — статусы record и минимальные field drafts;
  только в пределах `vaultId` текущего scope.

### Ingest/review tools

- `memora_document_stage_local_file` — принимает `documentType`, `localPath` и
  optional `testFixture`; требует `documents:ingest` и возвращает opaque handle.
- `memora_document_run_extraction` — принимает одноразовый handle, запускает
  quality/OCR/extractor и возвращает drafts/evidence, но не canonical fields.
- `memora_document_create_confirmation` — формирует diff и одноразовый token;
  не меняет canonical record.
- `memora_document_confirm_fields` — write action, требует token, actor, record,
  payload hash и expiry match; в Codex по умолчанию approval `writes`.

### Test/eval tool

- `memora_document_verify_fixture` — доступен только со scope
  `documents:test`, работает с синтетическим или явно отмеченным redacted
  fixture, сравнивает ожидаемые поля с draft mapping и возвращает field-level
  diff. Fixture не попадает в production vault и не подтверждает реальные
  документы.

Application enforces the `documents:test` capability before running this
deterministic verifier; transport layers never call the pure verifier directly.

Resources:

- `memora://document-types` — публичные схемы типов;
- `memora://document-record/{recordId}` — permission-filtered workspace;
- `memora://document-run/{runId}/evidence` — минимальные evidence без raw OCR
  payload и оригинальных изображений.

Каждый tool имеет Zod schema, стабильный error code и `readOnlyHint` либо
`destructiveHint`/approval annotation. MCP server instructions в первых 512
символах требуют: сначала получить workspace, затем показать diff, а
`confirm_fields` вызывать только после явного подтверждения пользователя.

## CLI

Пакет `@memora/cli` предоставляет:

```text
memora doctor
memora mcp serve --stdio
memora document types [--json]
memora document stage --type ru-passport --path <file> [--fixture]
memora document inspect --record <id>
memora document verify-fixture --fixture <id> [--json]
```

CLI не дублирует бизнес-логику. Команды преобразуют argv в application input,
печатают безопасный JSON/text output и возвращают стабильные exit codes.

## Безопасность и приватность

- локальный путь проверяется через `realpath`, остаётся под staging root и не
  возвращается в tool output;
- allowlist MIME/magic bytes, размер, число страниц/asset и quota проверяются до
  provider;
- оригиналы, crops, extracted text и evidence — private/no-store;
- MCP output содержит только минимальные значения, нужные для review, и не
  содержит raw bytes, MRZ целиком, private URL, secrets или provider response;
- scopes `read`, `ingest`, `review`, `confirm`, `test` разделены;
- audit хранит actor/action/target/result/correlation id, но не payload;
- confirmation token одноразовый, короткоживущий и привязан к actor, vault,
  record, набору полей и payload hash;
- данные из реального паспорта не используются в репозитории или fixture suite.

## Provider/OCR boundary

MCP/CLI не маскируют отсутствие OCR-провайдера. До provisioned provider,
privacy/region/retention review и benchmark минимум 30 обезличенных документов
на тип допустимы только `manual-only` и fixture verification. Для реального
российского внутреннего паспорта качество не считается доказанным по поддержке
международного ID; требуется отдельный benchmark по полям, confidence,
retake/review rate и deterministic validators.

## Acceptance criteria

- [ ] Web, CLI и MCP используют один application use case и одинаковые scopes;
- [ ] локальный STDIO MCP можно подключить к Codex/desktop ChatGPT без raw path
  или private URL в ответах;
- [ ] staging принимает только явно разрешённый файл, выдаёт expiring opaque
  handle и отклоняет path traversal/cross-vault access;
- [ ] extraction возвращает drafts/confidence/evidence, а canonical write
  требует отдельного confirmation token;
- [ ] fixture verification проверяет mapping без real PII и без production write;
- [ ] remote MCP endpoint имеет отдельный auth/tunnel plan и не считается
  готовым, пока не прошли OAuth/permission/transport smoke tests;
- [ ] RU/EN, error codes, CLI exit codes, audit/redaction и tool schemas
  задокументированы и покрыты тестами.

## Out of scope

- обещание 100% OCR или юридическое подтверждение личности;
- доступ MCP к произвольной файловой системе пользователя;
- автоматическое подтверждение паспортных данных;
- публикация remote endpoint без настроенной auth, rate limit, retention и
  production smoke;
- собственная OCR-модель до representative dataset и privacy/legal review.
