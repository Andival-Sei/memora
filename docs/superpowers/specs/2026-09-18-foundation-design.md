# Foundation: исполнимый дизайн

**Статус:** Approved
**Дата:** 2026-09-18
**Основание:** пользователь поручил продолжить реализацию утверждённого этапа
Foundation; ADR-0001 и продуктовая спецификация уже приняты.

## Результат

Репозиторий становится запускаемым npm/Turborepo workspace с Next.js App
Router приложением, реальными Vercel-интеграциями, защищённым app shell,
локализованными маршрутами RU/EN и темами light/dark/system.

## Контракты

- `apps/web` владеет HTTP/UI границей и получает identity только через Clerk.
- `packages/domain` не импортирует Next.js, Clerk, Drizzle или Vercel SDK.
- `packages/db` владеет Drizzle schema и подключением к provisioned Neon.
- `packages/contracts` владеет разделяемыми Zod-схемами.
- `packages/ui` владеет semantic tokens и UI primitives без бизнес-логики.
- Локали представлены маршрутами `/ru` и `/en`; неизвестная локаль не
  рендерит приложение.
- Тема задаётся semantic CSS tokens и `next-themes`; системный режим включён.
- `/api/health` проверяет только готовность процесса и не раскрывает секреты.
- Документы пока не загружаются: Foundation создаёт private Blob dependency,
  но upload/download появляются только в Documents vertical slice.

## Security boundary

- Все продуктовые маршруты, кроме sign-in/sign-up и health, защищает Clerk
  `proxy.ts`.
- Гость, открывающий `/:locale` или другой продуктовый маршрут в браузере,
  получает redirect на локальный `/:locale/sign-in`; API-контракты не
  редиректят чувствительные запросы в HTML.
- Client никогда не получает `CLERK_SECRET_KEY`, `DATABASE_URL` или
  `BLOB_READ_WRITE_TOKEN`.
- `.env.local`, `.vercel` и любые env-варианты исключены из Git.
- Схема Foundation создаёт только `users` и `vaults`; каждая пользовательская
  сущность последующих этапов обязана ссылаться на `vault_id`.
- Миграции выполняются по direct `DATABASE_URL_UNPOOLED`, runtime использует
  pooled `DATABASE_URL`.

## UX

Living Archive shell включает левую навигацию, основную рабочую область и
Memory Stream. Mobile использует компактную верхнюю панель и нижнюю навигацию.
RU/EN и обе темы имеют одинаковую функциональность. Движение использует только
transform/opacity и полностью отключает пространственное движение при
`prefers-reduced-motion`.

## Проверка

- unit/contract tests: локали, навигация и health contract;
- `tsc`, ESLint, production build;
- governance verifier;
- browser smoke в RU/EN, light/dark, desktop/mobile и reduced motion;
- Vercel preview/production deployment после локального GREEN.
