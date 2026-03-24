# kgd80 Workspace Guide

Быстрый вход в проект и документы:

- Общий роутинг документов: [docs/README.md](/workspaces/kdg80/docs/README.md)
- Канон сайта фестиваля: [docs/festival-landing-requirements.md](/workspaces/kdg80/docs/festival-landing-requirements.md)
- Канон системы регистрации: [docs/registration-system-requirements.md](/workspaces/kdg80/docs/registration-system-requirements.md)
- E2E-план и сценарии: [docs/registration-system-e2e-plan.md](/workspaces/kdg80/docs/registration-system-e2e-plan.md), [docs/behave/registration-system.feature](/workspaces/kdg80/docs/behave/registration-system.feature)
- Канон ticket/invitation: [docs/ticket-design-brief.md](/workspaces/kdg80/docs/ticket-design-brief.md)
- Preview-деплой сайта: [site/README.md](/workspaces/kdg80/site/README.md), [deploy-preview-to-yc.sh](/workspaces/kdg80/deploy-preview-to-yc.sh), [deploy-to-yc.sh](/workspaces/kdg80/deploy-to-yc.sh)
- Production-like E2E по secret preview: [scripts/run_registration_preview_e2e.py](/workspaces/kdg80/scripts/run_registration_preview_e2e.py)

## Быстрый маршрут для preview + E2E

1. Проверить локальные секреты в `docs/.env` или корневом `.env`.
2. Если в среде нет `aws`, поднять временный venv и поставить `awscli`.
3. Выложить secret preview на `kgd80.ru`.
4. Прогнать production-like E2E по preview URL.
5. Забрать артефакты из `test-results/registration-e2e-*`.

Команды:

```sh
python3 -m venv /tmp/awscli-venv
/tmp/awscli-venv/bin/pip install awscli
PATH="/tmp/awscli-venv/bin:$PATH" YC_PUBLIC_BASE_URL="https://kgd80.ru" ./deploy-preview-to-yc.sh
.venv-e2e/bin/playwright install chromium
.venv-e2e/bin/python scripts/run_registration_preview_e2e.py --base-url "https://kgd80.ru/preview-<slug>/"
```

## Где искать результаты

- Все одноразовые доказательства и скриншоты: [test-results](/workspaces/kdg80/test-results)
- Последние production-like preview артефакты обычно лежат в подпапке вида `registration-e2e-preview-<date>-<time>`

## Важная operational note

Если preview на `kgd80.ru/preview-.../` уже новый, а live ticket HTML на `/tickets/<public_hash>/` всё ещё старый, это обычно означает рассинхрон между выложенным статическим сайтом и версией registration backend на Fly.io. В таком случае смотреть нужно не только preview deploy, но и backend deploy/generator.
