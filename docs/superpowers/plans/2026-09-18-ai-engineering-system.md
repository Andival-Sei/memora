# AI Engineering System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** создать корневой operating contract и раскрываемые playbooks, которые
делают AI-разработку Memora воспроизводимой даже для модели с ограниченными
рассуждениями.

**Architecture:** `AGENTS.md` остаётся коротким маршрутизатором обязательного
цикла. Подробные ветки процесса живут в `docs/ai/`, а PowerShell-проверка
доказывает целостность набора документов. Работа выполняется напрямую в `main`
маленькими Conventional Commits на русском языке.

**Tech Stack:** Markdown, PowerShell 7/Windows PowerShell, Git, ripgrep.

**Spec:**
`docs/superpowers/specs/2026-09-18-ai-engineering-system-design.md`

## Global Constraints

- Основная среда — Windows 11 и PowerShell.
- Основная ветка — `main`; pull request не обязателен.
- Коммиты соответствуют Conventional Commits, описание пишется по-русски.
- Корневой `AGENTS.md` хранит только always-on workflow и context pointers.
- Любое completion claim требует свежих проверок и полного review diff.
- Архитектура, auth, security, БД, MCP/AI contracts и зависимости не передаются
  Luna без отдельного review сильной моделью.

---

### Task 1: Корневой operating contract и model routing

**Files:**

- Create: `AGENTS.md`
- Create: `docs/ai/MODEL_ROUTING.md`

**Interfaces:**

- Consumes: архитектурные инварианты из утверждённой спецификации.
- Produces: обязательный execution loop и функция выбора модели для всех
  последующих задач.

- [x] **Step 1: создать `AGENTS.md`**

Зафиксировать порядок intake → contract → RED → GREEN → verify → review →
commit/push, git-политику одной ветки, формат коммитов, completion gate и точные
условия открытия каждого документа `docs/ai/`.

- [x] **Step 2: создать model routing**

Определить три уровня риска и бинарный Luna gate. Luna разрешена только для
bounded leaf task с утверждённым task packet, зелёным baseline, существующими
тестами и без изменения security/architecture/public contracts/dependencies.

- [x] **Step 3: проверить маршрутизацию**

Run:

```powershell
rg -n "Luna|RED|GREEN|main|Conventional|docs/ai" AGENTS.md docs/ai/MODEL_ROUTING.md
```

Expected: присутствуют все ключевые маршруты; ни одно правило не ссылается на
неопределённый этап.

### Task 2: Workflow и task packet

**Files:**

- Create: `docs/ai/WORKFLOW.md`
- Create: `docs/ai/TASK_PACKET.md`

**Interfaces:**

- Consumes: классы изменений и execution loop из `AGENTS.md`.
- Produces: однозначный процесс исполнения и копируемый контракт задачи.

- [x] **Step 1: описать workflow**

Для каждого этапа указать вход, действия, наблюдаемый completion criterion и
stop condition. Отдельно описать direct-main fetch/rebase/push workflow без
force push и без захвата чужих изменений.

- [x] **Step 2: создать task packet template**

Шаблон содержит goal, class, spec/plan, allowed files, out of scope,
interfaces, acceptance criteria, RED command/expected failure, GREEN command,
full verification, risks, rollback и commit message.

- [x] **Step 3: проверить отсутствие неопределённости**

Run:

```powershell
rg -n -i "TO[D]O|TB[D]|implement[ ]later|appropriate[ ]tests|as[ ]needed" docs/ai/WORKFLOW.md docs/ai/TASK_PACKET.md
```

Expected: exit code 1, совпадений нет.

### Task 3: Архитектурные и security guardrails

**Files:**

- Create: `docs/ai/ARCHITECTURE_GUARDRAILS.md`
- Create: `docs/ai/SECURITY_AND_PRIVACY.md`

**Interfaces:**

- Consumes: `docs/architecture/ADR-0001-platform-and-stack.md` и
  `docs/product-spec.md`.
- Produces: review checklist для dependency direction, данных, auth, AI и MCP.

- [x] **Step 1: описать архитектурные границы**

Зафиксировать модульные ownership rules, разрешённые направления импортов,
правила use cases/repositories/transports и условия нового ADR.

- [x] **Step 2: описать security/privacy проверки**

Сформулировать positive path для private documents, tenant isolation, money,
uploads, secrets, logging, AI retrieval, tool mutations и external content.

- [x] **Step 3: сверить со спецификацией**

Run:

```powershell
rg -n "owner_id|vault_id|Private Blob|floating|draft|confirmation|MCP" docs/ai docs/architecture docs/product-spec.md
```

Expected: каждый security-инвариант имеет одно подробное правило и не
противоречит ADR.

### Task 4: UI/motion, quality gates и Definition of Done

**Files:**

- Create: `docs/ai/UI_AND_MOTION.md`
- Create: `docs/ai/QUALITY_GATES.md`
- Create: `docs/ai/DEFINITION_OF_DONE.md`
- Create: `docs/ai/COMMIT_CONVENTIONS.md`

**Interfaces:**

- Consumes: `docs/design/motion-system.md`, product NFR и commit policy spec.
- Produces: матрица применимых проверок и исчерпывающий completion gate.

- [x] **Step 1: описать UI contract**

Включить RU/EN parity, theme parity, server/client boundaries, accessibility,
reduced motion, performance budgets и обязательную browser verification.

- [x] **Step 2: создать quality matrix**

Разделить проверки для docs, domain, DB migration, API/MCP, UI, AI и dependency
changes. Для отсутствующих npm scripts указать stop condition, а не выдумывать
команду.

- [x] **Step 3: создать Definition of Done**

Сделать checklist доказательств: requirements, RED/GREEN, tests, typecheck,
lint, build, security, i18n/a11y/performance, diff, docs, commit и post-push.

- [x] **Step 4: вынести политику коммитов**

Повторить полную Conventional Commits грамматику в единственном подробном
источнике, а из `AGENTS.md` оставить короткий pointer и обязательный формат.

### Task 5: Машинная проверка governance

**Files:**

- Create: `scripts/verify-ai-governance.ps1`
- Modify: `README.md`

**Interfaces:**

- Consumes: список обязательных governance-файлов и относительные Markdown links.
- Produces: exit code 0 только для целостного набора инструкций.

- [x] **Step 1: написать failing probe для отсутствующего набора**

Run до создания всех документов:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ai-governance.ps1
```

Expected: команда ещё недоступна; это фиксирует исходное отсутствие verifier.

- [x] **Step 2: реализовать verifier**

Скрипт проверяет обязательные файлы, placeholder-маркеры, локальные Markdown
links, наличие ключевых секций и `git diff --check`. Ошибки собираются полностью,
печатаются с путём и дают ненулевой exit code.

- [x] **Step 3: связать README с AI workflow**

Добавить раздел для AI-разработки со ссылкой на `AGENTS.md`, спецификацию,
implementation plan и команду governance verification.

- [x] **Step 4: запустить verifier**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ai-governance.ps1
```

Expected: `AI governance verification passed.` и exit code 0.

### Task 6: Dry runs, review, commit и push

**Files:**

- Modify: только файлы из Tasks 1–5 при обнаружении дефекта.

**Interfaces:**

- Consumes: полный governance bundle.
- Produces: проверенный атомарный commit в `main`.

- [x] **Step 1: выполнить три dry run**

Проверить вручную маршруты:

1. UI toggle с RU/EN и motion;
2. миграция финансовой таблицы;
3. новый MCP tool с read и mutation вариантами.

Expected: каждый маршрут однозначно выбирает нужные playbooks, model tier,
проверки и stop conditions.

**Результат dry run:**

1. UI toggle открывает UI/motion и quality playbooks. До Foundation остаётся на
   Tier A/B; после зелёного baseline может стать Luna leaf task при готовом API,
   RU/EN criteria и browser verification.
2. Finance migration всегда Tier A: открывает architecture, security, quality,
   требует spec/plan, compatibility, rollback и integration tests.
3. Новый MCP tool всегда начинается в Tier A: открывает architecture/security,
   разделяет read/mutation scopes и требует permission/confirmation tests.

- [x] **Step 2: выполнить полную проверку**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ai-governance.ps1
git diff --check
git status --short
git diff --stat
git diff
```

Expected: verifier и diff check проходят; diff содержит только заявленные файлы.

- [x] **Step 3: создать атомарный коммит**

```powershell
git add -- AGENTS.md README.md docs/ai scripts/verify-ai-governance.ps1 docs/superpowers/plans/2026-09-18-ai-engineering-system.md
git commit -m "docs(ai): внедрить правила работы AI-агентов"
```

- [x] **Step 4: безопасно отправить `main`**

```powershell
git fetch origin
git status --short --branch
git push origin main
git status --short --branch
git log -1 --format="%H%n%s"
```

Expected: `main...origin/main`, опубликованный SHA и чистое рабочее дерево.
