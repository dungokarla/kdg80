# Claude Opus Prompt — Registration Visual / PDF Pass

Работаешь в репозитории `/workspaces/kdg80`.

Сделай финальный code-and-verify проход по визуалу и устойчивости процесса регистрации, не ограничиваясь обзором: внеси правки в код, прогоняй проверки и оставь рабочее состояние в ветке.

## Что уже сделано и что важно не сломать

- Сайт статический, registration backend живёт отдельно в `registration/`.
- Основной public registration status для сайта идёт через same-origin manifest `/tickets/registration/states.json`, API — только fallback.
- На Fly сейчас режим `REGISTRATION_OPERATING_MODE=testing`.
- Для mobile registration modal уже есть свежая правка sheet-структуры:
  - `site/src/components/RegistrationClient.astro`
  - `site/src/styles/global.css`
  - цель: форма на mobile не должна выглядеть как завершённая карточка с “ложным дном”.
- Для PDF уже добавлены live calendar links через PDFKit annotations:
  - `registration/src/services/ticket-artifacts.ts`
  - ссылки ведут на `event.ics`, `Google Calendar` и ticket page.

## Главные проблемы, которые нужно закрыть

1. `ticket HTML` и `PDF` визуально расходятся и PDF сейчас ломается на длинных заголовках/адресах.
2. В PDF есть жёстко заданные `y`-координаты; длинные тексты наезжают друг на друга.
3. Для части событий Фридландских ворот теряется точная площадка/маршрут:
   - нужно показывать `Корпус Блокгауз`
   - и полный адрес/маршрут, а не обрезанный generic hall/address.
4. Логотипы фестиваля должны быть устойчиво видны и в HTML, и в PDF.
5. Календарные действия в PDF уже технически возможны, но нужно проверить, что они выглядят уместно и не ломают композицию.
6. Нужно добить registration UX-review по всей цепочке:
   - CTA на карточке события
   - modal / sheet
   - validation states
   - successful redirect на invitation page
   - invitation HTML
   - invitation PDF

## Где смотреть код

- `site/src/components/RegistrationClient.astro`
- `site/src/styles/global.css`
- `site/src/components/EventCard.astro`
- `registration/src/services/ticket-artifacts.ts`
- `registration/src/services/catalog.ts`
- `registration/src/data/festival-events.json`
- `docs/registration-system-requirements.md`
- `docs/ticket-design-brief.md`

## Что ожидается от правок

1. Уйти от хрупкой fixed-layout PDF-композиции, где длинный title/address ломают страницу.
2. Сохранить lightweight-подход:
   - без Chromium HTML-to-PDF на production
   - без тяжёлых новых runtime-зависимостей, если можно решить на текущем `pdfkit`.
3. В HTML ticket page:
   - логотипы должны грузиться из надёжного источника, без production-404
   - площадка, зал, полный адрес и маршрут должны быть точными
   - если есть спикер, проверь, нужен ли он и где он уместен.
4. В PDF:
   - логотипы обязательны
   - title/date/venue/address/ticket ID/visitor читаются без наездов
   - ссылка на invitation page кликабельна
   - calendar links кликабельны и визуально не случайны
   - русские шрифты отображаются корректно.

## Важные ограничения

- Не трогай чужие локальные изменения вне своей задачи.
- Не откатывай пользовательские правки.
- Не ломай текущий manifest-first registration flow.
- Любое изменение, которое конфликтует с каноном, сначала синхронизируй с документами.

## Проверки, которые нужно обязательно выполнить

1. `npm run build` в `site/`
2. `npm run check` в `registration/`
3. Локальная генерация invitation HTML/PDF/ICS
4. Playwright visual verification:
   - desktop registration modal
   - mobile registration sheet
   - invitation HTML desktop/mobile
   - PDF viewer screenshot
5. Сохрани артефакты в `test-results/...`

## Что вернуть в результате

- список изменённых файлов
- короткий список закрытых проблем
- что осталось риском
- ссылки на свежие скрины / артефакты
- если деплоил preview: точный preview URL
