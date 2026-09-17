# UI и motion contract

Применяется к любому пользовательскому экрану, компоненту, тексту, графику или
анимации. Визуальный источник истины: `docs/design/motion-system.md`.

## Functional parity

- RU и EN реализуются в одном change set; строковый literal в UI допустим только
  как технический символ или локализованное значение из formatter.
- Light, dark и system используют semantic tokens, а не ветвление цветов внутри
  компонента.
- Keyboard, pointer и touch дают одинаково полный результат.
- Loading, empty, error, offline, optimistic и success states определены вместе
  с happy path.
- Server Component остаётся server-side, пока interaction/browser API не требует
  минимальной client boundary.

## Accessibility

- Semantic HTML и native control используются до ARIA abstraction.
- Focus видим, порядок логичен, modal/sheet возвращает focus инициатору.
- Touch target минимум 44×44 px; contrast соответствует WCAG 2.2 AA.
- Status/error доступен screen reader без дублирующего шума.
- Charts имеют текстовый summary/table и не кодируют смысл только цветом.
- Browser check включает keyboard-only flow и axe для затронутого маршрута.

## Motion

- Motion объясняет continuity, causality или confirmation. Декоративное движение
  без информационной роли удаляется.
- Простые state transitions выполняются CSS; Motion for React применяется для
  layout, presence, gestures и orchestrated sequences.
- Основные animated properties — `transform` и `opacity`; layout thrashing и
  тяжёлые blur/filter на scrolling surfaces не принимаются.
- Interaction feedback начинается до 100 ms. Route/shared transition имеет
  visual duration 350–500 ms; page emphasis не превышает 700 ms.
- `prefers-reduced-motion` сохраняет состояние и причинность без movement/zoom.
- Анимация прерываема повторным действием и не блокирует input.

## Performance budgets

- p75 LCP ≤ 1,8 s на целевом среднем мобильном профиле.
- INP ≤ 150 ms; локальный visual response ≤ 100 ms.
- Основные переходы держат 60 fps; 120 Hz не ограничивается искусственно.
- JS первой интерактивной страницы — цель ≤ 180 KB gzip.
- Декоративный client JS не является причиной гидратации server content.
- Большие editor/chart/motion возможности загружаются по route/interaction.

Превышение бюджета требует измерения, объяснения и утверждённого исключения, а
не удаления самого budget check.

## Browser verification

Для изменённого UI проверь минимум:

1. desktop и mobile viewport;
2. RU и EN с длинным текстом/числами;
3. light и dark, отсутствие theme flash;
4. keyboard navigation и focus;
5. reduced motion;
6. loading/error/empty и основной interaction;
7. console errors, hydration warnings и network failures;
8. screenshot/visual diff для визуально значимого изменения.

Компонент не считается готовым только по unit test или статичному screenshot:
нужен реальный interaction в browser.
