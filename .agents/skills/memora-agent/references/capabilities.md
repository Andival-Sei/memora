# Реестр capability Memora

Этот файл описывает capability, доступные Skill. Фактическая авторизация
определяется server-side scope; наличие имени здесь не выдаёт доступ.

## Реализовано в локальном MCP v0.1

| Capability | MCP tool | Scope | Мутация canonical data |
| --- | --- | --- | --- |
| Список схем документов | `memora_document_list_types` | `documents:read` | Нет |
| Staging явно выбранного файла | `memora_document_stage_local_file` | `documents:ingest` | Создаёт staging record, не поля |
| Workspace документа | `memora_document_get_workspace` | `documents:read` | Нет |
| Extraction | `memora_document_run_extraction` | `documents:review` | Только draft/evidence |
| Diff и confirmation token | `memora_document_create_confirmation` | `documents:review` | Нет |
| Подтверждение полей | `memora_document_confirm_fields` | `documents:confirm` | Да, после explicit confirmation |
| Fixture verifier | `memora_document_verify_fixture` | `documents:test` | Нет, production vault не изменяется |

Текущий extractor намеренно `manual-only`: отсутствие OCR provider должно быть
видно в warning, а не маскироваться пустым успешным результатом.

## Правила именования и версий

- Namespace отражает bounded context: `memora_document_*`,
  `memora_finance_*`, `memora_search_*`, `memora_integration_*`.
- Один tool выражает один понятный intent. Произвольные `eval`, SQL, shell и
  «сделай всё» tools запрещены.
- Input и output имеют versioned Zod schema и стабильные error codes.
- Read и mutation разделяются. Mutation помечается approval/confirmation и
  всегда проходит application use case.
- Breaking change требует нового tool/schema version и migration note; тихо
  менять смысл существующего tool нельзя.
- MCP resources дают permission-filtered представления, а не provider payload,
  абсолютные пути, raw bytes, private URL или секреты.

## Планируемые модули

| Namespace | Примеры будущих capability | Особое ограничение |
| --- | --- | --- |
| `documents` | multi-asset capture, OCR review, expiry reminders, export | оригиналы private, поля только через confirmation |
| `finance` | transaction draft, CSV preview, cash-flow report | minor units/decimal, idempotency, no direct AI write |
| `search` | permission-filtered semantic search, citations | фильтр owner/vault до ranking |
| `integrations` | sync status, import preview, revoke | least-privilege OAuth, rate limits, audit |
| `timeline` | reminders, due-date summaries | scheduled writes требуют отдельной политики |
| `admin` | diagnostics, exports, retention actions | отдельные scopes и усиленная confirmation |
