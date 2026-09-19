# Document records и OCR — implementation plan

## Task packet

- Goal: заменить generic document list на type-first records, multi-page intake
  и безопасные OCR drafts.
- Class: architectural, Tier A (schema, private PII processing, OCR provider,
  public UI/API contracts).
- Spec: `docs/superpowers/specs/2026-09-19-document-records-ocr.md`.
- Branch: `main`; direct commits, no pull request.
- Preserved changes: clean `main` synchronized with `origin/main`.
- Out of scope: KYC/legal identity guarantee, auto-delete, cloud provider
  provisioning without explicit authorization, bank integrations, AI mutations.

## Task 1 — type registry and record/asset intake contract

### Allowed files

- `packages/contracts/src/document-records.ts`
- `packages/contracts/src/index.ts`
- `packages/domain/src/document-records.ts`
- `packages/domain/src/document-records.test.ts`
- `packages/domain/src/index.ts`
- `packages/domain/package.json`
- `packages/db/src/schema.ts`
- `packages/db/src/document-records-repository.ts`
- `packages/db/src/index.ts`
- `packages/db/src/schema.test.ts`
- `packages/db/drizzle/*` generated migration/meta
- `packages/db/package.json`
- `package-lock.json`
- this plan and records spec

### Contract

- `DocumentTypeRegistry` owns versioned schemas for passport, international
  passport, driver's license, tax/insurance, birth certificate, contract and
  other;
- `DocumentRecordService.createRecord`, `addAssets`, `getWorkspace` require
  `vaultId`/actor scope and return no private Blob URL;
- one record accepts 1–5 assets, image/PDF allowlist, deterministic order and
  SHA-256 idempotency;
- status transitions are explicit and invalid transitions are rejected.

### RED → GREEN

1. Add registry, transition, multi-asset and duplicate tests; observe RED.
2. Add schema/migration/repository; preserve the already shipped generic PDF
   route as compatibility until UI cutover.
3. Verify owner scope, page order and no private fields in public DTO.

### Commit

`feat(records): добавить типы документов и многостраничный intake`

## Task 2 — document hub UX and multi-file upload

### Allowed files

- `apps/web/src/app/[locale]/documents/page.tsx`
- `apps/web/src/app/[locale]/documents/[recordId]/page.tsx`
- `apps/web/src/components/document-hub.tsx`
- `apps/web/src/components/document-record-workspace.tsx`
- `apps/web/src/components/*.test.tsx` for these components
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/messages/ru.json`
- `apps/web/src/messages/en.json`
- this plan and records spec

### Acceptance

- Home and Documents show type cards/statuses, not only a generic file list;
- type workspace accepts multiple pages with reorder/remove and accessible
  keyboard flow;
- RU/EN labels, themes and reduced-motion pass tests; no Blob URL in state.

### Commit

`feat(records): перестроить документы вокруг типов и карточек`

## Task 3 — OCR provider port, benchmark and draft extraction

### Gate before provider-specific code

- real provider is provisioned and credentials are available in approved secret
  storage;
- provider region/retention and PII opt-in are documented;
- 30 anonymized examples per type are available or the type is marked
  `manual-only`;
- expected field-level metrics and rollback are approved.

### Allowed files

- `packages/domain/src/document-ocr.ts`
- `packages/domain/src/document-ocr.test.ts`
- `packages/contracts/src/document-ocr.ts`
- `packages/ai/**` provider adapter and eval fixtures
- `apps/web/src/app/api/document-records/[recordId]/process/route.ts`
- `apps/web/src/app/api/document-records/[recordId]/review/route.ts`
- provider-specific environment/config docs
- this plan and records spec

### Acceptance

- OCR output is schema-validated draft with confidence/evidence;
- low-quality/low-confidence paths require retake/review;
- canonical fields change only via explicit confirmation and audit;
- benchmark report separates OCR text quality from field extraction quality.

### Commit

`feat(ocr): добавить проверяемые черновики распознавания документов`

## Task 4 — provider selection and production smoke

Provider choice is made after benchmark, not by model preference. Verify with
real private assets in a signed-in session, then run `npm run check`, security
review, audit/redaction checks, migration verification and production smoke.

## Stop conditions

- no provisioned OCR provider or missing approved secret;
- provider does not support required language/document type at target quality;
- any path would make raw image/OCR payload public or auto-confirm fields;
- benchmark sample contains real PII without explicit user-approved handling.
