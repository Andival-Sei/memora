# Memora Agent Skill и capability-модель — план реализации

**Спецификация:** `docs/superpowers/specs/2026-09-19-memora-agent-skill.md`

## Task packet

### Contract

- Goal: добавить repo-local `memora-agent` Skill, который направляет Codex к
  безопасным MCP/CLI workflows и фиксирует расширяемый capability contract.
- Class: architectural, docs/AI capability.
- Model tier: A.
- Spec: `docs/superpowers/specs/2026-09-19-memora-agent-skill.md`.
- Plan task: единственный task packet этого плана.
- Owner module: `.agents/skills/memora-agent`.

### Scope

- Allowed files:
  - `.agents/skills/memora-agent/SKILL.md`
  - `.agents/skills/memora-agent/references/capabilities.md`
  - `.agents/skills/memora-agent/references/document-workflow.md`
  - `.agents/skills/memora-agent/references/extension-checklist.md`
  - `docs/superpowers/specs/2026-09-19-memora-agent-skill.md`
  - `docs/superpowers/plans/2026-09-19-memora-agent-skill.md`
  - `README.md`
  - `docs/integrations/codex-chatgpt-mcp.md`
- Out of scope:
  - production code, database/schema/provider changes;
  - OCR provider и benchmark реальных паспортов;
  - remote MCP auth/Streamable HTTP и ChatGPT Apps SDK UI;
  - arbitrary filesystem, shell, SQL или universal `memora_execute` tool.
- Preserved user changes: none observed; рабочее дерево было чистым.

### Interfaces

- Consumes: существующие tools из
  `docs/superpowers/specs/2026-09-19-mcp-cli-codex-integration.md` и команды
  `memora` из `apps/cli`.
- Produces: `.agents/skills/memora-agent/SKILL.md` и три progressive-disclosure
  references; capability descriptor contract только как документированный
  TypeScript shape, без runtime registry.
- Data owner: application use cases и их scopes; Skill не владеет данными.
- Error contract: Skill не трансформирует error codes; агент сообщает
  application/MCP/CLI код и останавливается при permission/confirmation error.

### Acceptance criteria

- [ ] `quick_validate.py` принимает новый Skill и его frontmatter.
- [ ] Skill и references перечисляют только существующие document tools и
  manual-only OCR boundary.
- [ ] Workflow не допускает canonical write без explicit confirmation.
- [ ] Capability registry и checklist описывают versioning, scopes, audit,
  redaction и application ownership.
- [ ] Governance, полный check и `git diff --check` проходят; секретов и PII
  в diff нет.

### TDD evidence

- Test file: документационный Skill; runtime test не нужен, потому что production
  поведение не меняется.
- RED command: `python C:\Users\freed\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/skills/memora-agent` до создания Skill — ожидается ошибка отсутствующего пути.
- Expected RED: validator сообщает, что `.agents/skills/memora-agent` не существует.
- GREEN command: та же команда после создания Skill.
- Full verification:
  - `npm run check`
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ai-governance.ps1`
  - `git diff --check`

### Risk and recovery

- Risks: Skill может устареть при добавлении tool; broad instructions могут
  побудить агента выбирать неподдержанную capability; ссылки могут сломаться.
- Stop conditions: изменение затрагивает runtime/auth/provider, появляется
  новый public MCP contract или обнаруживается чужой diff.
- Rollback: `git revert <commit>` и повторить governance/full check; rollback не
  удаляет private assets.

### Delivery

- Commit: `feat(ai): добавить skill для Memora MCP и CLI`.
- Evidence to report: validator Skill, `npm run check`, governance, diff review,
  commit/push SHA и состояние `main`.

## Реализация

1. Проверить baseline и отсутствие незаявленных изменений.
2. Добавить короткий `SKILL.md`, оставив mode-specific детали в references.
3. Добавить capability registry, document workflow и extension checklist.
4. Обновить README и MCP integration guide ссылкой на Skill.
5. Запустить validator, full gates и проверить diff/секреты.
6. Создать один русский Conventional Commit и безопасно отправить в `main`.
