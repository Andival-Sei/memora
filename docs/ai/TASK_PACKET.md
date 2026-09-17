# Task Packet

Task packet — исполнимый контракт одного атомарного результата. Скопируй шаблон
в implementation plan или рабочую заметку задачи и заполни каждое поле до кода.

```markdown
# <Короткое имя результата>

## Contract

- Goal: <одно наблюдаемое предложение>
- Class: <trivial | bounded | architectural>
- Model tier: <A | B | C>
- Spec: <путь и конкретный раздел | not-applicable с причиной>
- Plan task: <путь и номер задачи | not-applicable с причиной>
- Owner module: <один модуль>

## Scope

- Allowed files:
  - `<точный путь>`
- Out of scope:
  - <явно исключённое соседнее поведение>
- Preserved user changes:
  - <путь/hunk | none observed>

## Interfaces

- Consumes: `<точная сигнатура, schema или contract>`
- Produces: `<точная сигнатура, schema или contract>`
- Data owner: `<модуль/таблица>`
- Error contract: `<типы ошибок и отображение>`

## Acceptance criteria

- [ ] <бинарно проверяемый результат>
- [ ] <edge/error case>
- [ ] <security/i18n/a11y/performance criterion, если применимо>

## TDD evidence

- Test file: `<точный путь>`
- RED command: `<полная команда>`
- Expected RED: `<конкретный assertion и причина>`
- GREEN command: `<полная команда>`
- Full verification: `<полные команды по QUALITY_GATES.md>`

## Risk and recovery

- Risks: <конкретные способы отказа>
- Stop conditions: <условия немедленной эскалации>
- Rollback: `git revert <commit>` и <проверка восстановления>

## Delivery

- Commit: `<type>(<scope>): <русское описание>`
- Evidence to report: <команды, количество тестов, UI/browser proof>
```

## Проверка качества packet

Packet готов к передаче только если:

- allowed files перечислены без glob, охватывающего соседние модули;
- out of scope запрещает очевидное расползание задачи;
- интерфейсы имеют точные имена и типы;
- каждый criterion проверяем командой или конкретным наблюдением;
- RED описывает ожидаемое падение, а не ошибку среды;
- rollback выполним без удаления чужих изменений;
- исполнитель не должен выбирать архитектуру, UX или security policy.
