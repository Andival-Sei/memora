# Documents private intake — план реализации

## Общий task packet

- Goal: реализовать безопасный PDF-only documents vertical slice с private Blob,
  Neon metadata, audit и RU/EN upload/list/download UI.
- Class: architectural, Tier A (private upload, auth/security boundary, schema,
  provider integration, public API).
- Spec: `docs/superpowers/specs/2026-09-19-documents-design.md`.
- Branch: `main`; commit directly, no pull request.
- Preserved changes: перед началом рабочее дерево чистое; посторонние файлы не
  включать.
- Product assumptions: один personal vault, PDF до 10 MiB, без OCR/search/delete
  в этом атомарном срезе.
- Out of scope: изображения/Office, extraction/indexing, sharing/export/delete,
  MCP/AI mutation, bank/Drive integrations, public Blob URLs.
- Provider prerequisite: Clerk, Neon и private Vercel Blob уже provisioned в
  production-like окружении; mock не считается provider integration.

## Task 1 — contracts, domain policy и persistence

### Allowed files

- `packages/contracts/src/documents.ts`
- `packages/contracts/src/index.ts`
- `packages/domain/src/documents.ts`
- `packages/domain/src/documents.test.ts`
- `packages/domain/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/documents-repository.ts`
- `packages/db/src/documents-repository.test.ts`
- `packages/db/drizzle/*` (только сгенерированная migration)
- `packages/db/package.json`
- `package-lock.json`
- этот plan и documents spec

### Contract

- ports: `DocumentRepository`, `PrivateBlobStore`, `DocumentService`;
- stable validation/error codes and `PublicDocument` без private fields;
- DB tables/indexes/FK as specified.

### RED

1. Добавить validation/service tests до production implementation.
2. `npm test --workspace=@memora/domain` должен упасть на отсутствующих exports.
3. Добавить schema contract tests; `npm test --workspace=@memora/db` должен
   упасть до новой schema/adapter.

### GREEN/REFACTOR

1. Реализовать pure validation и orchestration с injected id factory.
2. Добавить Drizzle schema, repository и migration; использовать pooled runtime
   connection только через существующий `getDb`, migration — direct Neon URL.
3. Вынести ошибки в contracts; не импортировать framework/storage в domain.

### Acceptance

- [x] domain tests зелёные с реальными функциями без provider mocks;
- [x] DB migration применена на Neon (`npm run db:migrate`);
- [x] queries требуют vault scope и не возвращают `blobPath` наружу;
- [x] cleanup и audit paths покрыты.

### Verification/commit

- `npm test --workspace=@memora/domain`
- `npm test --workspace=@memora/db`
- `npm run db:generate`, `npm run db:migrate`, `npm run check`
- Commit: `feat(documents): добавить доменную модель и private metadata`

## Task 2 — protected API и private Blob adapter

### Allowed files

- `apps/web/src/lib/documents/blob-storage.ts`
- `apps/web/src/lib/documents/blob-storage.test.ts`
- `apps/web/src/lib/documents/service.ts`
- `apps/web/src/app/api/documents/route.ts`
- `apps/web/src/app/api/documents/route.test.ts`
- `apps/web/src/app/api/documents/[id]/download/route.ts`
- `apps/web/src/app/api/documents/[id]/download/route.test.ts`
- `apps/web/src/lib/auth/*` только если требуется существующий контракт
- этот plan и documents spec

### Contract

- server-only provider adapter uses private `put/get/del` options;
- routes call application service, not Drizzle/Blob directly;
- guest/API errors and download headers match spec.

### RED → GREEN

1. Написать route tests for 401, malformed form, size limit, successful metadata,
   scoped list and generic 404; observe RED.
2. Implement adapter and route composition with injected service factory for
   tests; call `await auth()` inside each route.
3. Test provider adapter option shape without exposing token; leave live provider
   smoke to authenticated environment.

### Acceptance

- [x] no public URL/path in JSON;
- [x] private originals stream directly with no redirect and no browser cache;
- [x] failed DB write cleans only its newly-created Blob;
- [x] `npm run check` and `npm audit --omit=dev --audit-level=high` pass.

### Verification/commit

- Commit: `feat(documents): добавить защищённый upload и download API`

## Task 3 — localized documents UI and navigation

### Allowed files

- `apps/web/src/app/[locale]/documents/page.tsx`
- `apps/web/src/components/documents-workspace.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/messages/ru.json`
- `apps/web/src/messages/en.json`
- related UI tests under `apps/web/src/**`
- this plan and documents spec

### Contract

- keyboard-operable file chooser and list; localized status/error strings;
- light/dark/system and reduced-motion support; no provider URL displayed;
- successful upload refreshes list and download uses `/api/documents/{id}/download`.

### RED → GREEN

1. Add component test for idle/uploading/success/error and RU/EN keys; observe
   missing component/keys.
2. Implement client workspace with native form controls and restrained Motion
   transitions; avoid animation on reduced-motion.
3. Refactor only after tests are green; keep API response as untrusted data.

### Acceptance/commit

- [x] `npm run check`, keyboard/reduced-motion review and production preview smoke;
- Commit: `feat(documents): добавить локализованный экран документов`

## Completion gate

Before each commit read full diff and run `git diff --check`; after the final
commit run `npm run check`, governance verifier, migration status, `git status
--short --branch`, and safe push to `origin/main`. Report exact SHA and deployed
URL only when verified.
