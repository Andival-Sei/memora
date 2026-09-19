# Document records и OCR — спецификация

## Решение продукта

Memora не моделирует документ как одну вкладку или один файл. Каноническая
единица — `document_record`: тип личного документа, его структурированные поля,
состояние проверки и набор приватных исходников (`document_asset`). Раздел
Documents остаётся каталогом и inbox, но доступ к данным идёт также с Home,
Timeline, Finance и Assistant через карточки связанных records.

### Каталог первого релиза

- Паспорт РФ;
- заграничный паспорт;
- водительское удостоверение;
- СНИЛС/ИНН;
- свидетельство о рождении;
- полис/медицинский документ;
- договор/контракт;
- «Другой документ» с ручными полями и тегом.

Каждый тип имеет versioned field schema: key, label RU/EN, data type, required,
normalizer, validator, sensitivity и правила отображения. Схема типа не
зашивается в React-компонент и используется одинаково Web/CLI/MCP.

## UX

1. Home показывает «Мои документы» с карточками типов и состояниями `empty`,
   `processing`, `needs_review`, `confirmed`, `expired`.
2. Карточка типа открывает record workspace: поля слева, приватные страницы
   справа, статус распознавания и действия «Добавить страницу»/«Проверить».
3. Глобальное действие Add открывает выбор типа; это shortcut, а не единственный
   способ попасть к документам.
4. Один record принимает несколько фото/страниц, их можно reorder/remove до
   запуска обработки. Изображения и PDF смешивать можно только если provider
   contract это допускает; UI показывает ограничение.
5. Распознавание заполняет draft-поля. Каждое поле показывает confidence,
   источник (asset/page/bounding box) и кнопку принять/исправить. Низкая
   уверенность никогда не скрывается.
6. Только явное «Подтвердить данные» переносит draft в canonical fields. AI/OCR
   не перезаписывает подтверждённое значение без отдельного diff и подтверждения.

## Domain/persistence

### `document_records`

- `id`, `vault_id`, `document_type`, `schema_version`;
- `status`: `empty | processing | needs_review | confirmed | failed | expired`;
- `title`, `issued_at`, `expires_at` (nullable date-only), timestamps;
- unique active record policy per `(vault_id, document_type)` только для типов,
  где продукт её включит; несколько паспортов не теряются автоматически.

### `document_assets`

- `id`, `record_id`, `vault_id`, private `blob_path`;
- `page_index`, `content_type`, `size_bytes`, width/height, SHA-256;
- `quality_status`: `unknown | usable | retake_required`;
- оригинал всегда private Blob, key только из server UUID; hash нужен для
  идемпотентности и обнаружения повторной страницы.

### `document_extraction_runs`

- `id`, `record_id`, `provider`, `model`, `status`, attempt, timestamps;
- aggregate quality/confidence and safe error code;
- raw provider response и исходный prompt не сохраняются.

### `document_field_drafts`

- `run_id`, `record_id`, `field_key`, normalized/display value;
- `confidence`, `source_asset_id`, page, bounding box, `review_status`;
- draft is append-only per run; canonical value changes only through confirm use
  case and audit event.

## Extraction pipeline

```text
multi-upload -> private assets -> quality/preprocess -> classify/type check
     -> OCR/layout -> document-type extractor -> deterministic validators
     -> field drafts + evidence -> user review -> canonical record
```

### Защита качества

- OCR, extraction и canonical write — разные шаги и разные права;
- blurry/glare/rotation/low-resolution result получает `retake_required`, а не
  выдуманные поля;
- паспорт: дата/номер/серии проходят format/date checks; загранпаспорт дополнительно
  проверяет MRZ строки и ICAO checksums, затем сверяет их с OCR;
- дубликаты сравниваются по asset hash и нормализованным идентификаторам, но
  автоматически удаляться не могут;
- extraction result считается недоверенным внешним input и проходит Zod/schema
  validation до записи;
- метрики считаются по полям, а не «документ распознан»: precision, recall,
  reject/retake rate и доля ручных исправлений.

## OCR provider strategy

В коде сначала создаётся provider port:

```ts
interface DocumentOcrProvider {
  analyze(input: {
    documentType: DocumentType;
    assets: Array<{contentType: string; bytes: Uint8Array}>;
  }): Promise<ProviderExtractionResult>;
}
```

Production adapter нельзя писать до provisioned provider и privacy review. Для
первого benchmark-кандидата подходит Azure Document Intelligence: официальный
`prebuilt-idDocument` извлекает поля identity documents, а Read OCR является
основой для изображений/PDF; у F0 есть ограниченная бесплатная квота. Это не
доказывает покрытие российского внутреннего паспорта, поэтому нужен benchmark
на обезличенных примерах. Google Document AI остаётся альтернативой для OCR,
classification/splitting и custom extraction.

Если provider не provisioned, UI честно показывает `processing unavailable`, а
не маскирует ручную форму под работающий AI. Cloud OCR для PII — opt-in,
с указанием provider/region/retention; private Blob и provider response не
публикуются.

## Security/privacy

- оригиналы, thumbnails, OCR crops и evidence private/no-store;
- provider получает только минимальные assets конкретного run;
- secret/provider token server-only;
- logs/audit не содержат OCR text, MRZ, images, prompt или provider payload;
- confirmed field update создаёт diff/audit и требует actor confirmation;
- export/delete policy должна включать record, assets, drafts, runs и derived
  search chunks.

## Acceptance criteria

- [ ] каталог типов и record workspace не зависят от generic file list;
- [ ] один record принимает несколько страниц и сохраняет порядок/идемпотентность;
- [ ] field schema versioned и используется transport-independent;
- [ ] OCR output остаётся draft с confidence/evidence и не пишет canonical без
  подтверждения;
- [ ] provider benchmark содержит минимум 30 обезличенных документов на каждый
  включённый тип и field-level metrics;
- [ ] при низком confidence UI просит переснять/проверить, а не заполняет факт;
- [ ] originals/private derived artifacts не попадают в public URL, cache или logs;
- [ ] RU/EN, keyboard, light/dark и reduced-motion проверены.

## Out of scope этого решения

- автоматическое юридическое подтверждение личности;
- банковский KYC и передача документов третьим лицам без opt-in;
- обещание 100% OCR accuracy;
- обучение собственной модели до появления representative dataset и privacy/legal
  review.
