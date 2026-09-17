# Архитектурные guardrails

Этот документ применяется при изменении модулей, импортов, публичных
интерфейсов, схемы данных, deployment topology или внешних зависимостей.
Источники решения: `docs/architecture/ADR-0001-platform-and-stack.md` и
утверждённые последующие ADR.

## Направление зависимостей

```text
UI / HTTP / CLI / MCP transports
              ↓
       application use cases
              ↓
        domain contracts
              ↑
 DB / Blob / AI / provider adapters
```

- `domain` содержит entities, value objects, policies и domain events. Он не
  импортирует Next.js, React, Drizzle, Clerk, Vercel, AI SDK или transport code.
- `application` оркестрирует use cases, permissions и transactions через
  интерфейсы портов.
- adapters реализуют порты. Transport преобразует input/output, но не содержит
  бизнес-правила.
- web, CLI и MCP вызывают один use case с одинаковой авторизацией и audit.
- shared package создаётся только для стабильного контракта двух потребителей;
  папка `utils` не является архитектурной границей.

## Ownership модулей

| Модуль | Владеет | Не владеет |
|---|---|---|
| identity | users, vault membership, permissions | provider UI и finance data |
| documents | originals metadata, versions, chunks, expiry | Blob implementation и AI model |
| finance | accounts, transactions, categories, imports | document bytes и exchange provider |
| timeline | проекцией событий других модулей | исходными domain records |
| notifications | reminders и delivery state | правилами истечения документа |
| integrations | credentials refs, sync cursors/runs | canonical document/transaction logic |
| ai | retrieval orchestration, citations, tool drafts/evals | обходом permissions и прямой записью в БД |

Чужие данные изменяются через публичный use case владельца. Cross-module foreign
key не даёт вызывающему модулю право писать в таблицу владельца.

## Контракты и ошибки

- Public input/output описываются Zod v4 schema и TypeScript type из одного
  источника.
- Domain error имеет стабильный code; transport отдельно выбирает HTTP/MCP/CLI
  представление.
- `unknown` допустим на внешней границе до validation; `any` требует локального
  объяснения и отдельной проверки.
- Время хранится в UTC instant, а календарные даты без времени — отдельным
  date-only типом. Форматирование выполняется на границе UI.
- Деньги используют minor units для валют с фиксированной шкалой либо exact
  decimal с явным currency; арифметика через JS `number` запрещена.

## Данные и миграции

- Каждая пользовательская строка имеет `owner_id` или `vault_id`; repository
  требует scope в сигнатуре каждого запроса.
- Migration сначала проходит review обратимости, lock duration, backfill и
  совместимости старого/нового кода.
- Разрушительное изменение выполняется expand → migrate → verify → contract,
  а не одним deploy.
- Constraint и index являются частью correctness/performance contract и
  проверяются интеграционным тестом.
- Векторный индекс остаётся производным представлением; canonical data можно
  восстановить без него.

## Когда нужен новый ADR

Создай ADR до implementation plan, если меняется хотя бы одно:

- runtime, framework, database, storage, auth или AI provider strategy;
- направление зависимостей или ownership данных;
- sync/async boundary, очередь, consistency или retry model;
- encryption/key management, tenancy или external access model;
- публичный API/MCP contract с несовместимым изменением.

Локальная реализация утверждённого контракта отдельного ADR не требует.

## Review checklist

- [ ] Изменение находится в модуле-владельце.
- [ ] Dependency arrows направлены внутрь к domain/application.
- [ ] Transport не содержит бизнес-решений.
- [ ] Public schema и error codes определены до реализации.
- [ ] Tenant scope передаётся явно во все data operations.
- [ ] Money/time semantics точны и протестированы.
- [ ] Migration имеет compatibility и rollback strategy.
- [ ] Новая зависимость действительно нужна и provisioned корректным способом.
