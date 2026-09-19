# Memora

Memora — персональная операционная система для документов, финансов,
напоминаний, интеграций и AI. Первый клиент — быстрый адаптивный web/PWA;
архитектура сразу предусматривает MCP и CLI без дублирования бизнес-логики.

## Статус

Foundation реализован: приложение запускается, реальные бесплатные Neon, Clerk
и Private Blob provisioned через Vercel, а базовые маршруты, темы и RU/EN готовы.
Исходный контекст и поэтапный план зафиксированы в документах:

- [Продуктовая концепция](docs/product-spec.md)
- [ADR-0001: платформа и стек](docs/architecture/ADR-0001-platform-and-stack.md)
- [Дорожная карта](docs/roadmap.md)
- [Визуальная и motion-система](docs/design/motion-system.md)
- [Правила работы AI-агентов](AGENTS.md)

## Коротко о выбранном направлении

- Next.js 16.3.3 Active LTS, React 19.3, TypeScript, App Router.
- npm workspaces + Turborepo: `web`, `mcp`, `cli` и общие доменные пакеты.
- Neon PostgreSQL + Drizzle ORM; Vercel Blob Private для исходных файлов.
- Clerk для аутентификации; строгая изоляция данных пользователя.
- Vercel AI SDK v6 + AI Gateway; MCP TypeScript SDK v2.
- Tailwind CSS 4.3, собственные headless-компоненты на Radix primitives,
  Motion for React и View Transitions.
- RU/EN с первого пользовательского экрана; light/dark/system темы.

## Принципы

1. Privacy by design: финансовые данные и документы закрыты по умолчанию.
2. Один источник бизнес-правил для web, MCP и CLI.
3. AI предлагает действия, но изменение данных подтверждает пользователь.
4. Анимации объясняют изменение состояния и не ухудшают доступность.
5. Сначала законченные вертикальные срезы, затем новые модули.

## AI-разработка

Любой AI-агент начинает с [AGENTS.md](AGENTS.md). Подробный процесс, task packet,
model gate и quality gates находятся в [`docs/ai`](docs/ai/WORKFLOW.md).

- [Спецификация AI engineering system](docs/superpowers/specs/2026-09-18-ai-engineering-system-design.md)
- [Implementation plan](docs/superpowers/plans/2026-09-18-ai-engineering-system.md)
- [Когда задачу можно передать Luna](docs/ai/MODEL_ROUTING.md)
- [Definition of Done](docs/ai/DEFINITION_OF_DONE.md)
- [Memora Agent Skill для MCP/CLI](.agents/skills/memora-agent/SKILL.md)

Проверка целостности AI-инструкций на Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ai-governance.ps1
```

## Локальный запуск на Windows 11

Требуются Node.js 24 LTS, npm и авторизованный Vercel CLI.

```powershell
npm install
vercel link --yes --scope andival-seis-projects --project memora
vercel env pull apps/web/.env.local --yes
npm run dev
```

Приложение откроется на `http://localhost:3000/ru`. Проверки:

```powershell
npm run check
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ai-governance.ps1
```

Миграции используют только direct-подключение `DATABASE_URL_UNPOOLED`:

```powershell
npm run db:generate
npm run db:migrate
```

## Следующий шаг

Первый Documents vertical slice из [дорожной карты](docs/roadmap.md): приватная
загрузка PDF, метаданные, безопасное скачивание и audit trail.
