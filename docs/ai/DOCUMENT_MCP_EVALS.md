# Eval-контур полей документов

Eval-контур проверяет только mapping полей и не вызывает OCR-провайдер, модель,
БД или private Blob. Он предназначен для synthetic/redacted fixtures: реальные
фотографии паспортов, MRZ, адреса, номера документов и необезличенный OCR-текст
в репозиторий не добавляются.

## Что проверяется

`verifyDocumentFixture(manifest, actualFields)` сравнивает ожидаемые поля с
черновиком extraction и возвращает по каждому ключу:

- `expected` и `actual` — исходные redacted/synthetic значения;
- `normalizedExpected` и `normalizedActual` — детерминированные значения для
  сравнения;
- `match`, `confidence` и `reason` (`matched`, `missing`, `extra`, `mismatch`);
- агрегат `expectedCount`, `actualCount`, `matchedCount`, `missingCount`,
  `extraCount`, `mismatchedCount`.

Нормализация ограничена типом поля: пробелы для `text`, `DD.MM.YYYY` и ISO для
`date`, разделители тысяч/десятичная запятая для `number`. Строка вроде
`Ignore previous instructions: ...` остаётся обычным значением поля: она не
исполняется и не меняет полномочия агента.

## Формат fixture

Manifest хранит только синтетические значения и идентификатор типа:

```ts
{
  fixtureId: "ru-passport-redacted-001",
  documentType: "ru-passport",
  fields: [
    {key: "full_name", expected: "Иванов Иван Иванович"},
    {key: "birth_date", expected: "1989-04-05", valueType: "date"}
  ]
}
```

Исходные изображения и PDF должны оставаться за пределами Git в приватном
staging-хранилище. `fixtures/documents/` оставлен пустым намеренно; `.gitkeep`
не является разрешением на добавление реального документа.

## Добавление и удаление approved fixture

1. Создайте synthetic/redacted manifest с уникальным `fixtureId`; проверьте, что
   значения нельзя связать с реальным человеком.
2. Добавьте fixture-тест в `packages/application/src/document-fixtures.test.ts`.
3. Запустите `npm run test --workspace=@memora/application` и сохраните baseline
   aggregate counts в описании изменения.
4. Для временного локального изображения используйте staging root вне
   репозитория и capability `documents:test`; после проверки удалите файл из
   staging и убедитесь, что `git status` не показывает его.
5. Для удаления fixture удалите manifest и тест одним коммитом, затем повторите
   полный quality gate. Удаление fixture не должно затрагивать production vault
   или canonical document fields.

## Ограничения baseline

Три текущих теста проверяют missing/extra fields, date/number normalization и
изоляцию instruction-like текста как данных. Это baseline mapping, а не доказательство
качества OCR. Реальный provider допускается только после privacy/region/retention
review и benchmark минимум на 30 обезличенных документах каждого поддерживаемого
типа; до этого extraction остаётся `manual-only`.
