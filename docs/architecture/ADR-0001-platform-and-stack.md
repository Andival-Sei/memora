# ADR-0001: платформа и технологический стек Memora

**Статус:** Accepted

**Дата:** 2026-09-18

**Решение:** web/PWA-first, модульный монолит, общая доменная платформа для web,
MCP и CLI.

## Контекст

Memora хранит чувствительные документы и финансовые данные, должна одинаково
хорошо работать на Windows 11 и Android, иметь RU/EN, светлую/тёмную темы,
быстрый интерфейс, насыщенные анимации и полноценный AI-доступ через MCP/CLI.
Продуктовая область будет расти, поэтому важны модульные границы, но на старте
не оправданы распределённая система и несколько хранилищ истины.

Версии ниже отражают проверенный baseline на 2026-09-18. Patch-версии должны
обновляться Renovate после прохождения CI и preview-проверок.

## Решение

### Репозиторий и runtime

| Область | Выбор | Причина |
|---|---|---|
| Runtime | Node.js 24 LTS | Совместимость с Vercel Fluid Compute и длинный горизонт поддержки |
| Workspace | npm workspaces + Turborepo | Один lockfile, кэш задач, независимые приложения без лишней магии |
| Язык | TypeScript strict | Общие контракты от БД до MCP tools |
| Web | Next.js 16.3.3 App Router + React 19.3 | Server Components, streaming, Instant Navigations, View Transitions |
| Hosting | Vercel Fluid Compute | Node.js API, streaming и preview deployments без Edge runtime |
| Config | `vercel.ts` + `@vercel/config` | Типизированная конфигурация вместо `vercel.json` |

Планируемая структура:

```text
apps/
  web/          Next.js UI, BFF и HTTP API
  mcp/          Streamable HTTP и stdio MCP transports
  cli/          memora CLI
packages/
  domain/       сущности, value objects, политики и use cases
  db/           Drizzle schema, migrations, repositories
  contracts/    Zod v4 schemas, DTO и события
  auth/         permissions, scopes, session adapters
  ai/           agents, retrieval, tools, evals
  ui/           токены и доступные UI primitives
  config/       общие tsconfig/eslint/tooling presets
```

Домен организуется модулями `identity`, `documents`, `finance`, `timeline`,
`notifications`, `integrations`, `ai`. Модули общаются через публичные use-case
контракты и domain events; прямые импорты внутренних repository запрещены.

### Данные и файлы

| Задача | Выбор |
|---|---|
| Транзакционные данные | Neon PostgreSQL через Vercel Marketplace |
| Доступ к данным | Drizzle ORM + SQL для сложной аналитики |
| Поиск | PostgreSQL FTS + `pg_trgm` + `pgvector` для hybrid retrieval |
| Оригиналы документов | Vercel Blob Private, immutable object keys |
| Быстрые лимиты/кэш | Upstash Redis только после подтверждённой потребности |
| Фоновые операции | transactional outbox; durable queue/workflow подключается на этапе ingestion |

Один PostgreSQL остаётся источником истины. Векторный индекс не становится
отдельной базой на старте. Оригинал, извлечённый текст, версия парсера и каждое
производное представление версионируются независимо.

Ключевые сущности: `users`, `vaults`, `documents`, `document_versions`,
`document_chunks`, `accounts`, `transactions`, `categories`, `attachments`,
`reminders`, `integrations`, `sync_runs`, `ai_runs`, `audit_events`.

### Аутентификация и безопасность

- Clerk через Vercel Marketplace как быстрый и зрелый baseline.
- `owner_id`/`vault_id` обязательны во всех пользовательских таблицах;
  авторизация проверяется в use-case слое, а не только в UI.
- Private Blob выдаётся только через авторизованный route handler; публичные
  исходные URL запрещены.
- Короткоживущие scoped-токены для CLI/MCP; scopes разделяют read, import и
  mutation. Секреты хранятся только на сервере.
- Envelope encryption для особенно чувствительных извлечённых данных и токенов
  интеграций; провайдер ключей выбирается отдельным security ADR.
- Audit log append-only для входов, экспорта, просмотра файла и AI tool calls.
- Upload pipeline проверяет тип/размер, безопасно именует файлы и изолирует
  обработку. Содержимое документа всегда считается недоверенным вводом.
- AI никогда не получает весь vault «на всякий случай»: только минимальный
  контекст после permission-filtered retrieval.

### AI, MCP и CLI

- Vercel AI SDK v6 и AI Gateway: единый доступ к моделям, streaming,
  наблюдаемость, budgets и fallback без provider-specific кода в домене.
- Точная модель выбирается runtime-конфигурацией после live-проверки каталога,
  а не фиксируется в архитектуре.
- ToolLoopAgent для оркестрации; структурированные результаты валидируются Zod.
- RAG использует hybrid retrieval и возвращает стабильные citations на сущности.
- MCP TypeScript SDK v2 (`@modelcontextprotocol/server`): Streamable HTTP для
  удалённого доступа, stdio для Codex/Claude Code/локальных клиентов.
- MCP и CLI вызывают те же application use cases, что и web; они не ходят в БД
  напрямую и не получают обходной путь вокруг permissions/audit.

### UI, i18n и PWA

- Tailwind CSS 4.3 для CSS-first tokens, container queries и P3/OKLCH.
- Собственный UI kit поверх Radix primitives; shadcn используется как источник
  доступных паттернов, а не как неизменяемая визуальная тема.
- Motion for React для layout/gesture/shared-element motion; CSS и React View
  Transitions — для простых и навигационных переходов.
- `next-intl` с route locale `/ru` и `/en`, ICU messages и типизированными ключами.
- `next-themes` с режимами light/dark/system и без flash при гидратации.
- Installable PWA появляется после стабильного app shell. Кэшируются shell и
  безопасные справочники; документы и финансовые ответы не попадают в Cache API.
- Tauri 2 и Capacitor рассматриваются только при доказанной потребности в
  нативных API; web остаётся основной кодовой базой.

### Качество и наблюдаемость

- Vitest для unit/contract, Testing Library для компонентов, Playwright для E2E
  и visual regression, axe-core для accessibility.
- `tsc --noEmit`, ESLint, dependency audit, secret scanning и migration check в CI.
- OpenTelemetry + Vercel Observability; Sentry/другой внешний провайдер выбирается
  только после Marketplace discovery на этапе production hardening.
- Lighthouse CI и bundle budgets блокируют регрессии производительности.
- AI evals покрывают retrieval recall, citation correctness, tool selection,
  prompt injection и запрет неподтверждённых мутаций.

## Рассмотренные варианты

### Supabase как единый BaaS

**Плюсы:** Postgres, auth, storage и realtime в одном сервисе.

**Минусы:** UI/backend сильнее связываются с BaaS; отдельный private document
pipeline и MCP authorization всё равно требуют собственного application слоя.

Решение: не брать как основу первой архитектуры. Вернуться к варианту, если
единая консоль окажется важнее branching, Blob и Clerk-интеграции.

### Convex

**Плюсы:** прекрасный realtime DX и реактивные запросы.

**Минусы:** финансовая аналитика, переносимость SQL и pgvector хуже соответствуют
основному домену Memora.

### Отдельный NestJS backend с первого дня

**Плюсы:** явная серверная граница и независимое масштабирование.

**Минусы:** второй deploy/runtime, DTO-дублирование и более медленный первый
вертикальный срез без текущей нагрузки, которая это оправдывает.

Решение: Next.js BFF + чистые domain packages. Выделить worker/API позднее без
переписывания домена.

### Electron/Tauri как первый клиент

**Плюсы:** нативная упаковка и файловая система.
**Минусы:** слабее мобильный охват и усложнение доставки до проверки продукта.

Решение: responsive web/PWA-first; Tauri 2 — возможная оболочка позднее.

## Последствия

- Мы получаем один быстрый продукт для Windows, Android и web.
- Границы модулей и use cases позволяют безопасно добавить MCP/CLI.
- Потребуются дисциплина RSC/client boundaries и контроль animation bundle.
- Marketplace-интеграции необходимо реально provision до написания зависимого
  кода; `.env.example` не считается интеграцией.
- Самая ранняя архитектурная проверка — end-to-end vertical slice «загрузить
  чек → извлечь данные → подтвердить расход → найти его через MCP».

## Источники, проверенные 2026-09-18

- https://nextjs.org/blog — Next.js 16.3.3 Active LTS.
- https://react.dev/blog — React 19.3.
- https://tailwindcss.com/blog — Tailwind CSS 4.3.
- https://motion.dev/docs/react — Motion hybrid engine и React API.
- https://ts.sdk.modelcontextprotocol.io/v2/ — MCP TypeScript SDK v2.
- https://vercel.com/docs/vercel-blob/private-storage — private Blob.
