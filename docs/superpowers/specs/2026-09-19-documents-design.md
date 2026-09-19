# Documents private intake — спецификация

## Контекст и цель

Memora получает первый вертикальный срез пользовательских документов. Срез
должен позволять авторизованному владельцу vault загрузить PDF, увидеть его
метаданные и скачать оригинал обратно. Оригинал хранится только в private
Vercel Blob; клиент не получает публичный Blob URL. Все операции проходят через
application use case с явным `vault_id` scope и записывают audit event без
содержимого документа.

## Границы среза

### Входит

- один персональный vault на Clerk identity, создаваемый лениво при первом
  обращении к documents API;
- PDF до 10 MiB включительно;
- проверка расширения/нормализованного имени, MIME и сигнатуры `%PDF-`;
- private Blob upload с детерминированным серверным pathname, не содержащим
  пользовательского имени файла;
- метаданные: id, исходное нормализованное имя, MIME, размер, статус, даты;
- scoped list и download API;
- audit events для upload/download и отказов валидации/доступа без payload,
  private URL или текста документа;
- локализованный RU/EN экран загрузки, списка и скачивания, light/dark/system и
  reduced-motion поведение;
- quota guard на размер одного файла и структурированный JSON error contract.

### Не входит

- изображения, Office и архивы;
- OCR, извлечение текста, chunking, embeddings, полнотекстовый/семантический
  поиск, теги и сроки;
- удаление, экспорт, шаринг и multi-user vaults;
- client direct upload tokens и публичные `/_next` или Blob ссылки;
- AI/MCP mutation и внешняя синхронизация.

## Контракты

### Domain/application

`DocumentService` принимает Clerk identity и абстракции repository/private blob
store. Transport не вызывает Drizzle или Vercel Blob напрямую. Service:

1. валидирует файл до записи;
2. получает/создаёт персональный vault;
3. создаёт UUID и серверный pathname
   `vaults/{vaultId}/documents/{documentId}.pdf`;
4. пишет Blob с `access: "private"`, затем metadata;
5. при ошибке metadata удаляет только созданный Blob;
6. возвращает только публичные metadata, никогда `blobPath`;
7. list/download проверяет `vaultId` до чтения Blob.

### HTTP

- `POST /api/documents`, `multipart/form-data`, поле `file`:
  - `201 { document: PublicDocument }`;
  - `400 { error: { code, message } }` для неверного файла;
  - `401 { error: "Unauthorized" }` для гостя;
  - `413 { error: { code: "DOCUMENT_FILE_TOO_LARGE", message } }`;
  - `500 { error: { code: "DOCUMENT_UPLOAD_FAILED", message } }` без деталей
    provider или базы.
- `GET /api/documents`:
  - `200 { documents: PublicDocument[] }`, только текущий vault;
  - `401` для гостя.
- `GET /api/documents/{id}/download`:
  - `200` stream с `Cache-Control: no-store`, `Content-Disposition: attachment`,
    `X-Content-Type-Options: nosniff`;
  - одинаковый `404` для отсутствующего документа и чужого id;
  - `401` для гостя.

`PublicDocument` не содержит URL, pathname, Clerk id, owner id или audit data.

### Persistence

- `vaults.owner_id` уникален для lazy personal vault;
- `documents`: `vault_id`, `blob_path` unique, `original_filename`,
  `content_type`, `size_bytes` bigint, `status`, timestamps;
- `document_audit_events`: `vault_id`, optional `document_id`, actor Clerk id,
  action, result, timestamp; payload and provider response are forbidden;
- индексы list/audit по `(vault_id, created_at desc)`;
- все queries получают vault scope до поиска по document id.

## Security/privacy decisions

- token `BLOB_READ_WRITE_TOKEN` используется только в server module;
- pathname строится из server UUID, filename не участвует в key;
- Blob `get` вызывается с `access: "private"` и `useCache: false`;
- download не делает redirect к Blob URL;
- ошибки не отражают bucket, SQL, pathname, Clerk identity или исходный payload;
- filename очищается от control/path separators и ограничивается 120 символами;
- `size_bytes` проверяется до чтения всего тела;
- audit не содержит имени файла, текста, URL и секретов;
- browser cache для API и download запрещён.

## Наблюдаемость и производительность

- структурированные error codes стабильны для UI и CLI;
- upload ограничен 10 MiB, чтобы не превращать обычный request в unbounded
  memory operation;
- список возвращает не более 100 записей за запрос;
- будущая обработка OCR будет отдельной идемпотентной job и не блокирует этот
  upload contract.

## Acceptance criteria

- [ ] validation tests покрывают valid PDF, MIME/magic mismatch, size boundary и
  filename normalization;
- [ ] repository migration создаёт таблицы, FK, unique/index constraints и
  проходит на реальном Neon;
- [ ] service tests доказывают owner scope, cleanup при metadata failure и
  отсутствие private fields в public result;
- [ ] API tests доказывают 401/400/413/201/list/404 и no-store headers;
- [ ] production smoke доказывает public health и guest auth boundary; provider
  upload проверяется только после действующей auth-сессии;
- [ ] `npm run check`, governance verifier, `npm audit --omit=dev` и
  `git diff --check` зелёные.

## Rollback

Изменение откатывается одним `git revert` до миграции/кода. Миграция обратима
отдельным ручным SQL только после проверки отсутствия данных; автоматический
destructive rollback не выполняется. Private Blob originals удаляются только
явной продуктовой операцией после появления delete policy.
