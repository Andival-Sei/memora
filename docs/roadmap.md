# Дорожная карта Memora

План построен вертикальными срезами. Каждый этап заканчивается работающим
инкрементом в production-like preview, а не набором несвязанных экранов.

## 0. Foundation — 1 неделя

**Статус:** выполнено 2026-09-19. Реальные Vercel Marketplace-интеграции,
рабочее приложение, миграция Neon, auth boundary, RU/EN shell, темы и CI
зафиксированы в `main`.

- Создать npm/Turborepo workspace и Next.js 16.3.3 приложение.
- Подключить Vercel project и provision Clerk, Neon и private Blob через
  Marketplace; выполнить `vercel env pull`.
- Настроить `vercel.ts`, CI, preview deployments, Renovate и базовые budgets.
- Создать типизированные RU/EN dictionaries, light/dark/system theme и app shell.
- Зафиксировать domain boundaries и threat model.

**Готово, когда:** новый разработчик на Windows 11 запускает проект одной
документированной командой; CI, preview и smoke test зелёные.

## 1. Documents vertical slice — 2–3 недели

- Upload zone, private Blob, метаданные, список, карточка и скачивание.
- Асинхронный pipeline: MIME validation, text extraction, chunking, indexing.
- Поиск по имени/тегам/тексту; дата окончания и напоминание.
- Audit events, quota и безопасная обработка ошибок.
- E2E: загрузка PDF → поиск факта → удаление/экспорт согласно политике.

**Готово, когда:** оригинал нигде не публичен, поиск показывает источник, а
повторная обработка идемпотентна.

## 2. Finance vertical slice — 2–3 недели

- Счета, валюты, категории, income/expense/transfer и attachment receipt.
- Optimistic UI с серверной валидацией и корректным rollback.
- CSV import wizard: mapping, preview, deduplication и отчёт об ошибках.
- Dashboard cash flow и category drill-down.
- Локализованные суммы, даты, форматы и доступные графики.

**Готово, когда:** перевод атомарен, суммы хранятся в minor units/decimal без
ошибок float, а импорт можно безопасно повторить.

## 3. Assistant, MCP и CLI — 3 недели

- Hybrid retrieval и ответы с citations.
- AI tool drafts + confirmation UI + audit.
- Remote/stdio MCP server, OAuth/scoped tokens, resource и tool contracts.
- `memora` CLI: auth, search, import, export, doctor, mcp serve.
- Eval suite: retrieval, citations, injection, permission boundaries и costs.

**Готово, когда:** Codex/другой MCP host читает разрешённые данные, не может
обойти scopes и не выполняет мутацию без подтверждения.

## 4. Timeline, reminders и PWA — 2 недели

- Единый timeline документов, транзакций и сроков.
- Notification center и устойчивые scheduled reminders.
- Installable PWA, safe offline shell, background retry для черновиков.
- Windows 11/Android install и touch/keyboard QA.

**Готово, когда:** приложение устанавливается на обеих платформах, работает при
нестабильной сети и не кэширует чувствительные payloads.

## 5. Integrations — итеративно

- Сначала Gmail/Drive/Calendar или другой источник, выбранный по реальной
  пользовательской ценности и Marketplace discovery.
- Каждая интеграция имеет least-privilege scopes, backfill, incremental sync,
  idempotency, rate-limit handling, revoke flow и журнал синхронизации.
- Банковские подключения выбираются отдельно по географии и доступности API;
  CSV остаётся надёжным fallback.

## 6. Production hardening

- Security review, restore drill, load test, privacy/export/delete flows.
- CSP, rate limits, anomaly alerts, dependency/SBOM scanning.
- Наблюдаемость с redaction и SLO dashboards.
- Canary/rolling releases для рискованных изменений.

## Очередь после MVP

- Household vaults и granular sharing.
- Subscriptions, goals, budgets и forecast.
- Mobile capture/share extension и Tauri desktop shell.
- Локальный encrypted vault и opt-in end-to-end encryption mode.
- Plugin/automation SDK поверх того же capability model, что использует MCP.
