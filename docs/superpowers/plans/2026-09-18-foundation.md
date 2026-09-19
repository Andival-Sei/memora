# Foundation implementation plan

## Task 1 — Workspace и проверяемый app shell

### Contract

- Goal: `npm run dev` запускает локализованный и тематизируемый Memora shell,
  а `npm run check` полностью проходит.
- Class: architectural
- Model tier: A
- Spec: `docs/superpowers/specs/2026-09-18-foundation-design.md`
- Plan task: этот раздел
- Owner module: `apps/web`

### Scope

- Allowed files: `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`,
  `turbo.json`, `tsconfig.json`, `eslint.config.mjs`, `vercel.ts`,
  `.github/workflows/ci.yml`, `.github/renovate.json`, `.env.example`,
  `apps/web/**`, `packages/config/**`, `packages/contracts/**`,
  `packages/domain/**`, `packages/db/**`, `packages/ui/**`, `.agents/**`,
  `skills-lock.json`, `README.md`,
  этот plan и связанная Foundation spec.
- Out of scope: upload/download документов, финансовые операции, AI/MCP tools,
  production data migrations и PWA service worker.
- Preserved user changes: none; `.gitignore` change создан Vercel CLI в рамках
  текущей Foundation-задачи.

### Interfaces

- Consumes: Clerk env, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `BLOB_READ_WRITE_TOKEN` только на сервере.
- Produces: `/[locale]`, `/[locale]/sign-in`, `/[locale]/sign-up`,
  `GET /api/health -> {status:"ok"}`.
- Data owner: `packages/db`; Foundation tables `users`, `vaults`.
- Error contract: invalid locale -> `notFound`; отсутствующий runtime secret ->
  server-only configuration error без значения секрета.

### Acceptance criteria

- [ ] npm workspace и все quality scripts работают на Windows 11.
- [ ] RU/EN routes и light/dark/system shell доступны без строковых дубликатов.
- [ ] Product routes защищены Clerk, auth routes публичны.
- [ ] Drizzle schema хранит owner/vault boundary и UUID identifiers.
- [ ] Health не обращается к БД и не раскрывает конфигурацию.
- [ ] Build, lint, typecheck, tests и governance verifier зелёные.
- [ ] В Git отсутствуют секреты; preview deployment успешен.

### TDD evidence

- Test file: `apps/web/src/lib/i18n/routing.test.ts`,
  `apps/web/src/app/api/health/route.test.ts`
- RED command: `npm test`
- Expected RED: модули routing и health отсутствуют.
- GREEN command: `npm test`
- Full verification: `npm run check` и governance verifier.

### Risk and recovery

- Risks: несовместимость Next/Clerk, утечка env, hydration flash, неверная
  locale/auth matcher.
- Stop conditions: платный план, секрет в tracked diff, несовместимый provider
  contract или неустранимый baseline failure.
- Rollback: `git revert <commit>`; provisioned free resources удаляются отдельно
  только по явному запросу пользователя.

### Delivery

- Commit: `feat(foundation): создать рабочую основу приложения`
- Evidence to report: tests/typecheck/lint/build, browser matrix, deployment URL,
  published SHA.
