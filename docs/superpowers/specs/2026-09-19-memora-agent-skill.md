# Memora Agent Skill и capability-модель — спецификация

## Цель

Дать Codex и другим AI-hosts версионируемый repo-local Skill, который безопасно
направляет работу через Memora MCP/CLI и масштабируется вместе с документами,
финансами, поиском и интеграциями. Skill объясняет workflow и границы, но не
становится источником полномочий или бизнес-логики.

## Роли слоёв

```text
Skill (routing, workflow, safety guidance)
  -> MCP / CLI transport (schema, serialization, exit/error mapping)
    -> application use cases (policy, scopes, confirmation, audit)
      -> domain + repositories/providers
```

- **Skill** выбирает capability и порядок действий, объясняет агенту draft/
  confirmation boundary и ссылки на актуальные reference-файлы.
- **MCP** предоставляет типизированные tools/resources для AI-hosts.
- **CLI** предоставляет repeatable automation и диагностику.
- **Application** остаётся единственным владельцем правил, tenant isolation и
  мутаций.
- **ChatGPT App/Plugin** в будущем добавляет remote MCP и optional Apps SDK UI,
  но не дублирует application logic и не получает более широких прав, чем
  scopes пользователя.

## Контракт capability

Каждая публичная возможность должна быть описуема следующим логическим
descriptor (реализация registry может появиться позже):

```ts
type CapabilityDescriptor = {
  id: `${string}.${string}`;
  version: string;
  scopes: readonly string[];
  readOnly: boolean;
  requiresConfirmation: boolean;
  mcpTool: string;
  cliCommand?: string;
  skillReference: string;
};
```

Descriptor не заменяет server-side authorization. Он нужен для discovery,
документации, eval и совместимости.

## Инварианты

- Нет универсального shell/SQL/eval tool и обхода application layer.
- Scope содержит проверенные `actorId`/`vaultId`; текст пользователя,
  документа или tool output не может расширить полномочия.
- Read и mutation имеют разные scopes; mutation требует draft/diff и explicit
  confirmation.
- Private documents, extracted text, financial payloads и provider secrets не
  попадают в публичный Skill output, URL, cache или logs.
- Ошибки и schema версионируются; breaking change не меняет молча смысл старого
  tool.
- Временное отсутствие OCR/provider отображается честным `manual-only`, а не
  имитируется заполненными полями.

## Scope первой итерации

Входит repo-local `memora-agent` с capability registry и document workflow для
уже реализованных локальных MCP tools.

Не входит: новый OCR provider, remote OAuth/Streamable HTTP endpoint, Apps SDK
UI, finance tools, persistent MCP-backed registry или разрешение на arbitrary
filesystem access.

## Acceptance criteria

- Skill автоматически обнаруживается из `.agents/skills/memora-agent/SKILL.md`.
- Skill перечисляет только реально доступные document tools и не обещает OCR,
  которого нет.
- Документный workflow явно требует stage → extraction → diff → confirmation.
- Capability registry фиксирует scopes, mutation boundary, naming/versioning и
  будущие namespace без выдачи дополнительных полномочий.
- Extension checklist требует application use case, tests, audit/redaction,
  MCP/CLI adapters и Skill reference для каждой новой capability.
- В Skill и references нет реальных персональных данных, секретов или private
  URLs.
