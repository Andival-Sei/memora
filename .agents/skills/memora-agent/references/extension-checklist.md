# Checklist для новой capability

Любая новая capability проходит этот порядок до появления в Skill или публичном
MCP contract:

1. Определить bounded context, owner/vault boundary и минимальный scope.
2. Описать application use case и DTO в `packages/application` или другом
   владельце доменной логики. Transport не обращается к DB/Blob напрямую.
3. Добавить input/output schema, стабильные error codes и negative tests,
   включая cross-vault/permission case.
4. Разделить read-only и mutation. Mutation сначала создаёт draft/diff и
   одноразовый confirmation token; audit не содержит sensitive payload.
5. Зарегистрировать MCP tool/resource с annotations, redaction и version.
6. Добавить CLI-команду только если операция нужна для repeatable automation;
   CLI преобразует argv в тот же use case.
7. Добавить eval/fixture без real PII, injection-isolation test и документацию
   для Skill.
8. Обновить capability registry и rollout/rollback note.
9. Для внешнего provider сначала подтвердить provisioning, region/retention,
   rate limits и production smoke; mock не считается интеграцией.

Не добавляй новую capability только в `SKILL.md`: Skill не должен становиться
скрытым вторым API и не может компенсировать отсутствие server-side enforcement.
