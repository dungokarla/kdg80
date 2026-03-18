# Festival Site

Исходники сайта находятся в каталоге `site/`. Проект собран на Astro и рассчитан на Node.js 22.

## Локальный запуск

```sh
cd site
npm ci
npm run dev -- --host 0.0.0.0 --port 4321
```

После запуска открой `http://localhost:4321`.

## Сборка

```sh
cd site
npm run build
```

Готовый статический сайт будет собран в `site/dist/`.

## DevPod

В репозитории есть `.devcontainer/devcontainer.json`, поэтому DevPod может поднять рабочее окружение прямо из репозитория.

1. Создай workspace из Git-репозитория.
2. Укажи этот репозиторий и ветку `main`.
3. DevPod использует `devcontainer`-конфигурацию и автоматически выполнит `cd site && npm ci`.
4. После старта открой терминал и запусти:

```sh
cd site
npm run dev -- --host 0.0.0.0 --port 4321
```

5. Пробрось порт `4321` и открой превью в браузере.

Если нужно просто проверить production-сборку:

```sh
cd site
npm run build
npm run preview -- --host 0.0.0.0 --port 4321
```
