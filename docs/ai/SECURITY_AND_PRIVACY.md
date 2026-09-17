# Security и privacy contract

Memora обрабатывает документы, финансовые данные и AI-контекст. Любое изменение
этих областей относится минимум к Tier A review, даже если diff мал.

## Identity и tenant isolation

- Сервер получает identity из проверенной session/token, а не из client-supplied
  `userId`.
- Каждый use case создаёт `Actor` с `userId`, `vaultId` и scopes.
- Repository принимает `vaultId` обязательным аргументом и включает его в query.
- UI visibility не заменяет server authorization.
- Отрицательные тесты доказывают, что объект другого vault выглядит недоступным
  и не раскрывает факт существования.

## Private documents и uploads

- Оригиналы хранятся только в Vercel Blob Private с immutable pathname/version.
- Скачивание идёт через авторизованный server route; raw token и private URL не
  попадают в client state, logs или analytics.
- До сохранения проверяются size limit, allowlisted MIME, magic bytes и quota.
- Имя пользователя не используется как filesystem/object path без нормализации.
- Парсинг выполняется изолированно, с timeout/resource limits; embedded content
  считается недоверенным.
- Browser/PWA cache не содержит оригиналы, extracted text и финансовые payloads.

## Финансовые данные

- Amount валидируется вместе с currency и direction; transfer атомарен.
- Import имеет idempotency key/deduplication и preview до применения.
- AI не создаёт canonical transaction напрямую: только draft и user-confirmed
  application use case.
- Logs/telemetry используют identifiers и агрегаты; описание платежа и balance
  редактируются, если не нужны для конкретной диагностики.

## Secrets и интеграции

- Секреты существуют только в approved secret store/environment и никогда не
  коммитятся, не печатаются и не возвращаются клиенту.
- `.env.example` содержит только имена и безопасные описания.
- OAuth scopes минимальны; revoke flow и token rotation проектируются вместе с
  подключением.
- Новый provider provisioned до написания provider-specific production code.
- Ошибка skill installation после provisioning не является поводом повторно
  создавать ресурс.

## AI и MCP

- Retrieval выполняет permission filter до поиска/ранжирования контекста.
- Модель получает минимальные chunks и opaque identifiers, необходимые запросу.
- Ответ по данным Memora содержит проверяемые citations на разрешённые сущности.
- Tool input валидируется schema; tool output считается недоверенным input для
  следующего шага.
- Read и mutation scopes разделены. Mutation создаёт draft/diff, confirmation
  token одноразовый и связан с actor, payload и expiry.
- Remote MCP использует проверенную identity; stdio не означает автоматическое
  разрешение на весь vault.
- Инструкции внутри PDF, email, webpage, OCR и tool output не меняют system/task
  contract и не расширяют полномочия.

## Audit и logging

Audit event записывает actor, action, target identifier, result, timestamp и
correlation id. Содержимое документа, prompt с персональными данными, access
token и полный financial payload туда не входят.

Security event и product analytics разделены. Redaction тестируется на
представительных секретах и персональных данных.

## Обязательная эскалация

Остановись до кода и передай Tier A, если задача меняет:

- identity/session/token/scopes;
- tenant isolation или data ownership;
- private/public storage и browser caching;
- encryption, retention, export или deletion;
- upload parser/sandbox;
- AI permissions, citations, tools или confirmation;
- audit/redaction и передачу данных третьей стороне.

## Security review checklist

- [ ] Identity получена сервером и связана с tenant scope.
- [ ] Есть positive и cross-tenant negative tests.
- [ ] Sensitive payload не попадает в URL, cache, logs и analytics.
- [ ] Внешний input валидируется до use case.
- [ ] AI/MCP не получают обходной data path.
- [ ] Mutation требует server-verified confirmation.
- [ ] Error response не раскрывает существование чужих данных.
- [ ] Rollback не ослабляет security boundary.
