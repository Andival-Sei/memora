# Memora

Memora — персональная операционная система для документов, финансов,
напоминаний, интеграций и AI. Первый клиент — быстрый адаптивный web/PWA;
архитектура сразу предусматривает MCP и CLI без дублирования бизнес-логики.

## Статус

Проект находится на этапе архитектурного проектирования. Исходный контекст,
выбранный стек, границы модулей и поэтапный план уже зафиксированы в документах:

- [Продуктовая концепция](docs/product-spec.md)
- [ADR-0001: платформа и стек](docs/architecture/ADR-0001-platform-and-stack.md)
- [Дорожная карта](docs/roadmap.md)
- [Визуальная и motion-система](docs/design/motion-system.md)

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

## Следующий шаг

Этап Foundation из [дорожной карты](docs/roadmap.md): создать workspace,
подключить реальные Marketplace-интеграции, собрать design-system shell и
настроить CI. Для полноценной агентной работы нужен Vercel CLI (`vercel env
pull`, preview deploys и logs).
