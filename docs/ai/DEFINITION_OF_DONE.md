# Definition of Done

Отметь каждый применимый пункт свежим доказательством. `N/A` требует короткой
причины. Непроверенный пункт означает, что задача не завершена.

## Contract

- [ ] Goal достигнут без расширения out of scope.
- [ ] Каждый acceptance criterion имеет команду или наблюдаемое доказательство.
- [ ] Allowed files соблюдены; пользовательские изменения сохранены.
- [ ] Public interfaces и документация совпадают с реализацией.

## Correctness

- [ ] Для изменения поведения наблюдался ожидаемый RED.
- [ ] Targeted test GREEN после минимальной реализации.
- [ ] Affected и full test suites прошли без новых warnings/skips.
- [ ] Format, lint, typecheck и production build прошли, если применимы.
- [ ] Error/edge/idempotency/concurrency cases из packet проверены.

## Architecture и security

- [ ] Dependency direction и module ownership сохранены.
- [ ] Tenant/data owner передаётся явно.
- [ ] Money/time semantics точны.
- [ ] Sensitive data отсутствует в public URL, cache, logs, analytics и diff.
- [ ] AI/MCP permissions, citations и confirmation соблюдены.
- [ ] Migration/integration имеет recovery и rollback.

## Product UI

- [ ] RU и EN функционально равны.
- [ ] Light/dark/system проверены.
- [ ] Keyboard/touch/focus/axe проверены.
- [ ] Reduced motion сохраняет функциональность.
- [ ] Loading/empty/error/offline/optimistic states проверены по scope.
- [ ] Browser interaction и console/network состояние проверены.
- [ ] Performance/bundle budgets не ухудшены либо исключение утверждено.

## Delivery

- [ ] `git diff --check` чист.
- [ ] Полные unstaged и staged diffs прочитаны.
- [ ] Debug code, случайные artifacts, secrets и незаявленные файлы отсутствуют.
- [ ] Коммит атомарен и соответствует русскому Conventional Commits.
- [ ] Откат возможен через `git revert`.
- [ ] После push локальная ветка синхронизирована с `origin/main`.
- [ ] Финальный отчёт разделяет доказанное, непроверенное и оставшуюся работу.
