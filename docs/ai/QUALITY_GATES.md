# Матрица quality gates

Команды проекта берутся из актуального `package.json`/workspace, а не из памяти.
Если требуемый script отсутствует, задача останавливается: сначала Tier A/B
добавляет или утверждает проверку. Нельзя подменять build линтером или полный
suite одним тестом.

## Gates по типу изменения

| Изменение | Обязательные доказательства |
|---|---|
| Только docs | governance/link check, spelling/format при наличии, `git diff --check` |
| Domain/use case | RED–GREEN unit tests, affected suite, typecheck, lint, full tests |
| DB/schema | migration test, constraints/indexes, compatibility, rollback drill, integration tests |
| API/CLI/MCP | contract/schema tests, auth positive/negative, error mapping, transport smoke |
| UI | component tests, typecheck/lint, browser interaction, axe, RU/EN, themes, reduced motion |
| AI/RAG | retrieval/citation evals, permission/injection tests, tool schema, mutation confirmation, cost sample |
| Dependency/config | official source verification, install/build/test, bundle/security impact, lockfile review |
| Performance | repeatable before/after measurement, budget checks, representative production build |

## Порядок запуска

1. **Baseline:** применимые команды до изменения или зафиксированное отсутствие
   проекта/script для foundation/config task.
2. **Targeted RED:** один конкретный тест падает ожидаемым assertion.
3. **Targeted GREEN:** тот же тест проходит.
4. **Affected suite:** пакет/модуль целиком.
5. **Static gates:** format, lint, typecheck.
6. **Full gates:** все tests и production build.
7. **Specialized:** e2e, browser, accessibility, security, migration, AI evals,
   Lighthouse/bundle — по строке матрицы.
8. **Diff gates:** `git diff --check`, secret scan и полный human/agent review.

## Что считать доказательством

Отчёт содержит команду, exit code, количество passed/failed/skipped и ключевой
результат specialized check. «Должно работать», предыдущий запуск, сообщение
другого агента и частичная команда доказательством не являются.

Skipped test допустим только если его причина существовала до задачи и явно
зафиксирована. Новый skip, snapshot update или budget exception требует review
Tier A/B.

## Baseline красный

Если baseline не проходит:

1. не смешивай его исправление с текущей задачей;
2. зафиксируй точную команду и полный релевантный failure;
3. установи, пересекается ли failure с разрешённым scope;
4. остановись и запроси решение пользователя, если пересекается или мешает RED;
5. если не пересекается и пользователь разрешил продолжить, докажи, что diff не
   увеличивает список failures.
