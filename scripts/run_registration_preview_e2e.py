#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import base64
import html
import json
import textwrap
import time
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

from dotenv import dotenv_values
from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright
from telethon import TelegramClient
from telethon.sessions import StringSession

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / 'docs' / '.env'
STATE_MANIFEST_URL = 'https://kgd80.ru/tickets/registration/states.json'
STATE_API_URL = 'https://znanie-kgd80-fest.fly.dev/api/v1/public/events/states'


@dataclass
class EventExample:
  slug: str
  title: str
  public_state: str
  cta_label: str


@dataclass
class ScenarioTrace:
  name: str
  manifest_requested: bool = False
  api_requested: bool = False
  registration_requested: bool = False
  ticket_requested: bool = False


def load_env() -> dict[str, str]:
  values = dotenv_values(ENV_PATH)
  return {key: value for key, value in values.items() if value is not None}


def normalize_base_url(value: str) -> str:
  return value if value.endswith('/') else f'{value}/'


def create_output_dir(output_dir_arg: str | None) -> Path:
  if output_dir_arg:
    path = Path(output_dir_arg).expanduser()
    return path if path.is_absolute() else ROOT / path

  timestamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
  return ROOT / 'test-results' / f'registration-e2e-preview-{timestamp}'


def read_auth_bundle(env: dict[str, str]) -> dict[str, Any]:
  payload = env['TELEGRAM_AUTH_BUNDLE_S22']
  return json.loads(base64.urlsafe_b64decode(payload + '===').decode('utf-8'))


def fetch_json(url: str) -> Any:
  request = urllib.request.Request(url, headers={'accept': 'application/json'})
  with urllib.request.urlopen(request, timeout=30) as response:
    return json.loads(response.read().decode('utf-8'))


def pick_examples(manifest_items: list[dict[str, Any]]) -> dict[str, EventExample]:
  targets = {
    'registration_open': None,
    'registration_closed': None,
    'registration_soon': None,
    'sold_out': None,
  }

  for item in manifest_items:
    state = item.get('publicState')
    if state in targets and targets[state] is None:
      targets[state] = EventExample(
        slug=item['slug'],
        title=item['title'],
        public_state=state,
        cta_label=item['ctaLabel'],
      )

  missing = [state for state, example in targets.items() if example is None]
  if missing:
    raise RuntimeError(f'Could not find live examples for states: {", ".join(missing)}')

  return {state: example for state, example in targets.items() if example is not None}


def router_for_mode(mode: str, trace: ScenarioTrace):
  def handler(route, request):
    parsed = urlparse(request.url)
    hostname = parsed.hostname or ''

    if 'mc.yandex.ru' in hostname:
      try:
        route.abort()
      except Exception:
        pass
      return

    if hostname == 'znanie-kgd80-fest.fly.dev' and parsed.path.startswith('/api/v1/public/events/states'):
      trace.api_requested = True
      if mode == 'dual_outage':
        try:
          route.abort()
        except Exception:
          pass
      else:
        try:
          route.continue_()
        except Exception:
          pass
      return

    if hostname == 'znanie-kgd80-fest.fly.dev' and parsed.path.startswith('/api/v1/register'):
      trace.registration_requested = True
      try:
        route.continue_()
      except Exception:
        pass
      return

    if hostname in ('kgd80.ru', 'www.kgd80.ru') and parsed.path == '/tickets/registration/states.json':
      trace.manifest_requested = True
      if mode in {'manifest_missing', 'dual_outage'}:
        try:
          route.fulfill(
            status=404,
            body='not found',
            content_type='text/plain; charset=utf-8',
          )
        except Exception:
          pass
      else:
        try:
          route.continue_()
        except Exception:
          pass
      return

    if hostname in ('kgd80.ru', 'www.kgd80.ru') and parsed.path.startswith('/tickets/'):
      trace.ticket_requested = True
      try:
        route.continue_()
      except Exception:
        pass
      return

    try:
      route.continue_()
    except Exception:
      pass

  return handler


def create_context(
  browser: Browser,
  mode: str,
  test_run_id: str | None = None,
  mock_now_iso: str | None = None,
) -> tuple[BrowserContext, ScenarioTrace]:
  trace = ScenarioTrace(name=mode)
  context = browser.new_context(
    locale='ru-RU',
    timezone_id='Europe/Kaliningrad',
    color_scheme='light',
    viewport={'width': 1440, 'height': 1600},
  )
  if test_run_id:
    context.add_init_script(
      script=textwrap.dedent(
        f"""
        (() => {{
          const testRunId = {json.dumps(test_run_id)};
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {{
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/api/v1/register') && init && typeof init.body === 'string') {{
              try {{
                const payload = JSON.parse(init.body);
                payload.testRunId = testRunId;
                init = {{ ...init, body: JSON.stringify(payload) }};
              }} catch {{}}
            }}
            return originalFetch(input, init);
          }};
        }})();
        """
      )
    )
  if mock_now_iso:
    context.add_init_script(
      script=textwrap.dedent(
        f"""
        (() => {{
          const mockNow = Date.parse({json.dumps(mock_now_iso)});
          Date.now = () => mockNow;
        }})();
        """
      )
    )
  context.route('**/*', router_for_mode(mode, trace))
  return context, trace


def create_mobile_context(browser: Browser, mode: str) -> tuple[BrowserContext, ScenarioTrace]:
  trace = ScenarioTrace(name=f'{mode}-mobile')
  context = browser.new_context(
    locale='ru-RU',
    timezone_id='Europe/Kaliningrad',
    color_scheme='light',
    viewport={'width': 390, 'height': 844},
    is_mobile=True,
    has_touch=True,
    user_agent=(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ),
  )
  context.route('**/*', router_for_mode(mode, trace))
  return context, trace


def open_homepage(page: Page, base_url: str) -> None:
  page.goto(base_url, wait_until='domcontentloaded')
  page.wait_for_timeout(5000)


def event_card(page: Page, slug: str):
  return page.locator(f'#event-{slug}')


def event_button(page: Page, slug: str):
  return page.locator(f'#event-{slug} [data-registration-cta]')


def wait_for_label(page: Page, slug: str, expected: str, timeout_ms: int = 25000) -> None:
  deadline = time.time() + (timeout_ms / 1000)
  locator = event_button(page, slug)
  while time.time() < deadline:
    try:
      text = (locator.text_content() or '').strip()
      if text == expected:
        return
    except Exception:
      pass
    page.wait_for_timeout(250)

  current = ''
  try:
    current = (locator.text_content() or '').strip()
  except Exception:
    current = '<unavailable>'
  raise RuntimeError(f'Expected "{expected}" for {slug}, got "{current}"')


def screenshot_card(page: Page, slug: str, target_path: Path) -> None:
  locator = event_card(page, slug)
  locator.scroll_into_view_if_needed()
  page.wait_for_timeout(500)
  locator.screenshot(path=str(target_path))


def screenshot_page_state(page: Page, slug: str, target_path: Path) -> None:
  locator = event_card(page, slug)
  locator.scroll_into_view_if_needed()
  page.wait_for_timeout(700)
  page.screenshot(path=str(target_path))


def open_registration_modal(page: Page, slug: str) -> None:
  wait_for_label(page, slug, 'Регистрация')
  event_card(page, slug).scroll_into_view_if_needed()
  page.wait_for_timeout(400)
  event_button(page, slug).click()
  page.locator('.registration-modal').wait_for(state='visible')
  page.wait_for_timeout(400)


def close_registration_modal(page: Page) -> None:
  page.locator('.registration-modal__close').click()
  page.wait_for_timeout(300)


def set_form_values(
  page: Page,
  *,
  full_name: str,
  email: str,
  phone: str,
  consent: bool,
) -> None:
  page.locator('[name="fullName"]').fill(full_name)
  page.locator('[name="email"]').fill(email)
  page.locator('[name="phone"]').fill(phone)
  page.locator('[name="consentAccepted"]').set_checked(consent)


def expect_inline_error(page: Page, expected_message: str) -> None:
  locator = page.locator('small, [data-registration-status]')
  locator.filter(has_text=expected_message).first.wait_for(state='visible', timeout=5000)


def iso_plus_minutes(iso_value: str, minutes: int) -> str:
  value = datetime.fromisoformat(iso_value.replace('Z', '+00:00'))
  return (value + timedelta(minutes=minutes)).isoformat().replace('+00:00', 'Z')


def resolve_status(url: str) -> int:
  request = urllib.request.Request(url, method='HEAD')
  try:
    with urllib.request.urlopen(request, timeout=30) as response:
      return response.status
  except Exception:
    request = urllib.request.Request(url, headers={'accept': '*/*'})
    with urllib.request.urlopen(request, timeout=30) as response:
      return response.status


def render_report(browser: Browser, target_path: Path, title: str, lines: list[str]) -> None:
  context = browser.new_context(viewport={'width': 1200, 'height': 900})
  page = context.new_page()
  items = ''.join(f'<li>{html.escape(line)}</li>' for line in lines)
  page.set_content(
    f"""
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <title>{html.escape(title)}</title>
        <style>
          body {{
            margin: 0;
            padding: 48px;
            background: #f3efe4;
            color: #1e2430;
            font-family: "Georgia", "Times New Roman", serif;
          }}
          .card {{
            max-width: 980px;
            margin: 0 auto;
            background: #fffdf8;
            border: 2px solid #d5c2a5;
            border-radius: 20px;
            box-shadow: 0 24px 60px rgba(36, 26, 10, 0.12);
            padding: 36px 40px;
          }}
          h1 {{
            margin: 0 0 20px;
            font-size: 42px;
            line-height: 1.1;
          }}
          ul {{
            margin: 0;
            padding-left: 24px;
            font-size: 24px;
            line-height: 1.5;
          }}
          li + li {{
            margin-top: 12px;
          }}
          p {{
            margin: 0 0 18px;
            font-size: 18px;
            color: #5a6577;
          }}
        </style>
      </head>
      <body>
        <div class="card">
          <p>Автосводка из Playwright + Telethon</p>
          <h1>{html.escape(title)}</h1>
          <ul>{items}</ul>
        </div>
      </body>
    </html>
    """,
    wait_until='load',
  )
  page.screenshot(path=str(target_path), full_page=True)
  context.close()


async def inspect_telegram(env: dict[str, str], bot_username: str, full_name: str) -> dict[str, Any]:
  bundle = read_auth_bundle(env)
  api_id = int(env['TELEGRAM_API_ID'])
  api_hash = env['TELEGRAM_API_HASH']
  client = TelegramClient(
    StringSession(bundle['session']),
    api_id,
    api_hash,
    device_model=bundle.get('device_model'),
    system_version=bundle.get('system_version'),
    app_version=bundle.get('app_version'),
    lang_code=bundle.get('lang_code'),
    system_lang_code=bundle.get('system_lang_code'),
  )
  await client.connect()
  await client.send_message(bot_username, '/help')
  await asyncio.sleep(2)

  recent = await client.get_messages(bot_username, limit=4)
  recent_text = [msg.raw_text or '' for msg in recent]
  matches: list[dict[str, Any]] = []

  async for msg in client.iter_messages(None, search=full_name, limit=5):
    chat = await msg.get_chat()
    matches.append({
      'chat': (
        getattr(chat, 'title', None)
        or getattr(chat, 'username', None)
        or getattr(chat, 'first_name', None)
        or 'unknown'
      ),
      'message_id': msg.id,
      'text': msg.raw_text or '',
    })

  await client.disconnect()
  return {
    'recent_messages': recent_text,
    'matches': matches,
  }


async def cleanup_test_run(
  env: dict[str, str],
  bot_username: str,
  run_id: str,
  event_slug: str,
  seats_taken_before_cleanup: int | None,
) -> dict[str, Any]:
  bundle = read_auth_bundle(env)
  api_id = int(env['TELEGRAM_API_ID'])
  api_hash = env['TELEGRAM_API_HASH']
  client = TelegramClient(
    StringSession(bundle['session']),
    api_id,
    api_hash,
    device_model=bundle.get('device_model'),
    system_version=bundle.get('system_version'),
    app_version=bundle.get('app_version'),
    lang_code=bundle.get('lang_code'),
    system_lang_code=bundle.get('system_lang_code'),
  )
  await client.connect()
  await client.send_message(bot_username, f'/cleanup_test_run {run_id}')
  await asyncio.sleep(3)
  recent = await client.get_messages(bot_username, limit=4)
  recent_text = [msg.raw_text or '' for msg in recent]
  await client.disconnect()

  before = seats_taken_before_cleanup
  after = None
  deadline = time.time() + 90
  while time.time() < deadline:
    manifest = fetch_json(STATE_MANIFEST_URL)
    item = next((entry for entry in manifest.get('items', []) if entry.get('slug') == event_slug), None)
    if item is None:
      break
    after = item.get('seatsTaken')
    if before is None or (isinstance(after, int) and isinstance(before, int) and after < before):
      return {
        'recent_messages': recent_text,
        'after': item,
        'generated_at': manifest.get('generatedAt'),
      }
    await asyncio.sleep(2)

  manifest = fetch_json(STATE_MANIFEST_URL)
  item = next((entry for entry in manifest.get('items', []) if entry.get('slug') == event_slug), None)
  return {
    'recent_messages': recent_text,
    'after': item,
    'generated_at': manifest.get('generatedAt'),
  }


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description='Run production-like registration E2E against a secret preview on kgd80.ru',
  )
  parser.add_argument('--base-url', required=True, help='Secret preview URL, for example https://kgd80.ru/preview-20260323-abcdef/')
  parser.add_argument('--output-dir', help='Optional output directory. Default: test-results/registration-e2e-preview-<timestamp>')
  parser.add_argument('--bot-username', default='kgd80regbot', help='Telegram bot username for Telethon check')
  parser.add_argument('--full-name', default='Иван Кодексов Тестовый', help='Identity used for the real registration submit')
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  base_url = normalize_base_url(args.base_url)
  output_dir = create_output_dir(args.output_dir)
  output_dir.mkdir(parents=True, exist_ok=True)

  env = load_env()
  manifest = fetch_json(STATE_MANIFEST_URL)
  api = fetch_json(STATE_API_URL)
  examples = pick_examples(manifest['items'])
  manifest_items_before = {item['slug']: item for item in manifest['items']}

  run_id = f'registration-preview-e2e-{int(time.time())}'
  full_name = args.full_name
  email = f'kgd80+{run_id}@gmail.com'
  phone = '+7999' + str(int(time.time() * 1000) % 10_000_000).zfill(7)

  summary: dict[str, Any] = {
    'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'run_id': run_id,
    'base_url': base_url,
    'registration_identity': {
      'full_name': full_name,
      'email': email,
      'phone': phone,
    },
    'examples': {key: asdict(value) for key, value in examples.items()},
    'live_manifest_generated_at': manifest.get('generatedAt'),
    'live_api_item_count': len(api.get('items', [])),
  }

  with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    context, normal_trace = create_context(browser, 'normal')
    page = context.new_page()
    open_homepage(page, base_url)
    for state, example in examples.items():
      wait_for_label(page, example.slug, example.cta_label)
      screenshot_card(page, example.slug, output_dir / f'{state}-desktop.png')
      screenshot_page_state(page, example.slug, output_dir / f'{state}-list-desktop.png')
    summary['desktop_trace'] = asdict(normal_trace)
    context.close()

    mobile_context, mobile_trace = create_mobile_context(browser, 'normal')
    mobile_page = mobile_context.new_page()
    open_homepage(mobile_page, base_url)
    wait_for_label(mobile_page, examples['registration_open'].slug, examples['registration_open'].cta_label)
    wait_for_label(mobile_page, examples['registration_closed'].slug, examples['registration_closed'].cta_label)
    screenshot_page_state(mobile_page, examples['registration_open'].slug, output_dir / 'registration-open-mobile.png')
    screenshot_page_state(mobile_page, examples['registration_closed'].slug, output_dir / 'registration-closed-mobile.png')
    summary['mobile_trace'] = asdict(mobile_trace)
    mobile_context.close()

    past_context, past_trace = create_context(
      browser,
      'normal',
      mock_now_iso=iso_plus_minutes(manifest_items_before[examples['registration_open'].slug]['endsAt'], 10),
    )
    past_page = past_context.new_page()
    open_homepage(past_page, base_url)
    wait_for_label(past_page, examples['registration_open'].slug, 'Событие прошло')
    screenshot_page_state(past_page, examples['registration_open'].slug, output_dir / 'past-list-desktop.png')
    summary['past_trace'] = asdict(past_trace)
    past_context.close()

    fallback_context, fallback_trace = create_context(browser, 'manifest_missing')
    fallback_page = fallback_context.new_page()
    open_homepage(fallback_page, base_url)
    wait_for_label(fallback_page, examples['registration_open'].slug, examples['registration_open'].cta_label)
    screenshot_card(fallback_page, examples['registration_open'].slug, output_dir / 'manifest-fallback-api-desktop.png')
    summary['manifest_fallback_trace'] = asdict(fallback_trace)
    fallback_context.close()

    outage_context, outage_trace = create_context(browser, 'dual_outage')
    outage_page = outage_context.new_page()
    open_homepage(outage_page, base_url)
    wait_for_label(outage_page, examples['registration_open'].slug, 'Проверяем регистрацию…')
    screenshot_card(outage_page, examples['registration_open'].slug, output_dir / 'dual-outage-desktop.png')
    summary['dual_outage_trace'] = asdict(outage_trace)
    outage_context.close()

    validation_context, validation_trace = create_context(browser, 'normal')
    validation_page = validation_context.new_page()
    open_homepage(validation_page, base_url)
    open_registration_modal(validation_page, examples['registration_open'].slug)
    validation_page.locator('.registration-form__checkbox').screenshot(path=str(output_dir / 'consent-block-desktop.png'))
    validation_page.screenshot(path=str(output_dir / 'registration-form-empty-desktop.png'))

    validation_cases = [
      ('validation-name-desktop.png', '<script>alert(1)</script>', 'ivan@example.com', '+79991234567', True, 'Укажите имя и фамилию полностью.'),
      ('validation-email-desktop.png', 'Иван Иванов', 'invalid-email', '+79991234567', True, 'Проверьте email: адрес выглядит некорректно.'),
      ('validation-phone-desktop.png', 'Иван Иванов', 'ivan@example.com', '+7123', True, 'Введите российский номер в формате +7XXXXXXXXXX.'),
      ('validation-consent-desktop.png', 'Иван Иванов', 'ivan@example.com', '+79991234567', False, 'Подтвердите согласие на обработку персональных данных, чтобы продолжить.'),
    ]

    for filename, full_name_case, email_case, phone_case, consent_case, message in validation_cases:
      set_form_values(
        validation_page,
        full_name=full_name_case,
        email=email_case,
        phone=phone_case,
        consent=consent_case,
      )
      validation_page.locator('[data-registration-submit]').click()
      expect_inline_error(validation_page, message)
      validation_page.screenshot(path=str(output_dir / filename))
      close_registration_modal(validation_page)
      open_registration_modal(validation_page, examples['registration_open'].slug)

    summary['validation_trace'] = asdict(validation_trace)
    validation_context.close()

    registration_context, registration_trace = create_context(browser, 'normal', test_run_id=run_id)
    registration_page = registration_context.new_page()
    open_homepage(registration_page, base_url)
    open_example = examples['registration_open']
    wait_for_label(registration_page, open_example.slug, open_example.cta_label)
    event_card(registration_page, open_example.slug).scroll_into_view_if_needed()
    event_button(registration_page, open_example.slug).click()
    registration_page.locator('[name="fullName"]').fill(full_name)
    registration_page.locator('[name="email"]').fill(email)
    registration_page.locator('[name="phone"]').fill(phone)
    registration_page.locator('[name="consentAccepted"]').check()
    registration_page.screenshot(path=str(output_dir / 'registration-form-desktop.png'))
    with registration_page.expect_response(lambda response: '/api/v1/register' in response.url and response.request.method == 'POST') as register_info:
      registration_page.locator('[data-registration-submit]').click()
    register_response = register_info.value
    summary['register_status'] = register_response.status
    if register_response.status != 201:
      summary['register_error_text'] = (registration_page.locator('[data-registration-status]').text_content() or '').strip()
      registration_page.screenshot(path=str(output_dir / 'registration-error-desktop.png'))
      raise RuntimeError(
        f"Registration submit returned {register_response.status}: {summary['register_error_text'] or 'no inline error text'}"
      )
    registration_page.wait_for_url(
      'https://kgd80.ru/tickets/**',
      timeout=60000,
      wait_until='domcontentloaded',
    )
    registration_page.wait_for_timeout(2000)
    summary['ticket_url'] = registration_page.url
    summary['ticket_heading_excerpt'] = registration_page.locator('body').inner_text()[:500]
    registration_page.screenshot(path=str(output_dir / 'ticket-page-desktop.png'), full_page=True)
    summary['registration_trace'] = asdict(registration_trace)
    registration_context.close()

    consent_links = []
    consent_page_context, consent_page_trace = create_context(browser, 'normal')
    consent_page = consent_page_context.new_page()
    open_homepage(consent_page, base_url)
    open_registration_modal(consent_page, examples['registration_open'].slug)
    for locator in consent_page.locator('.registration-form__checkbox a').all():
      href = locator.get_attribute('href') or ''
      absolute_url = urljoin(base_url, href)
      consent_links.append({
        'href': absolute_url,
        'status': resolve_status(absolute_url),
      })
    consent_page.screenshot(path=str(output_dir / 'registration-form-consent-desktop.png'))
    summary['consent_links'] = consent_links
    summary['consent_trace'] = asdict(consent_page_trace)
    consent_page_context.close()

    render_report(
      browser,
      output_dir / 'summary.png',
      'Registration Preview E2E',
      [
        f'Preview URL: {base_url}',
        f'Manifest timestamp: {manifest.get("generatedAt")}',
        f'Open: {examples["registration_open"].title} -> {examples["registration_open"].cta_label}',
        f'Closed: {examples["registration_closed"].title} -> {examples["registration_closed"].cta_label}',
        f'Soon: {examples["registration_soon"].title} -> {examples["registration_soon"].cta_label}',
        f'Sold out: {examples["sold_out"].title} -> {examples["sold_out"].cta_label}',
        f'Manifest fallback hit API: {summary["manifest_fallback_trace"]["api_requested"]}',
        'Dual outage kept loading CTA: verified',
        f'Consent link statuses: {[item["status"] for item in summary["consent_links"]]}',
        f'Registration submit status: {summary["register_status"]}',
        f'Ticket URL: {summary["ticket_url"]}',
      ],
    )

    browser.close()

  telegram_info = asyncio.run(inspect_telegram(env, args.bot_username, full_name))
  summary['telegram_check'] = telegram_info
  manifest_after = fetch_json(STATE_MANIFEST_URL)
  manifest_items_after = {item['slug']: item for item in manifest_after['items']}
  summary['manifest_after_registration'] = {
    'generated_at': manifest_after.get('generatedAt'),
    'before': manifest_items_before.get(examples['registration_open'].slug),
    'after': manifest_items_after.get(examples['registration_open'].slug),
  }
  cleanup_info = asyncio.run(
    cleanup_test_run(
      env,
      args.bot_username,
      run_id,
      examples['registration_open'].slug,
      manifest_items_after.get(examples['registration_open'].slug, {}).get('seatsTaken'),
    )
  )
  summary['cleanup'] = cleanup_info

  with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    telegram_lines = [
      f"/help latest: {(telegram_info['recent_messages'][0] if telegram_info['recent_messages'] else 'no messages')}",
      f"Fresh notification matches for '{full_name}': {len(telegram_info['matches'])}",
    ]
    if telegram_info['matches']:
      telegram_lines.extend(
        f"{match['chat']}: {match['text'][:120]}"
        for match in telegram_info['matches']
      )
    else:
      telegram_lines.append('Current session sees no fresh registration notification for this run.')

    render_report(
      browser,
      output_dir / 'telegram-evidence.png',
      'Telegram Check',
      telegram_lines,
    )
    browser.close()

  (output_dir / 'summary.json').write_text(
    json.dumps(summary, ensure_ascii=False, indent=2),
    encoding='utf-8',
  )
  (output_dir / 'summary.md').write_text(
    textwrap.dedent(
      f"""
      # Registration Preview E2E Evidence

      - Run ID: `{run_id}`
      - Generated at: `{summary['generated_at_utc']}`
      - Preview URL: `{base_url}`
      - Live manifest generated at: `{summary['live_manifest_generated_at']}`
      - Manifest after registration: `{summary['manifest_after_registration']['generated_at']}`
      - Cleanup manifest timestamp: `{summary['cleanup']['generated_at']}`
      - Registration status: `{summary['register_status']}`
      - Ticket URL: `{summary['ticket_url']}`

      ## Selected live examples

      - Open: `{examples['registration_open'].title}` -> `{examples['registration_open'].cta_label}`
      - Closed: `{examples['registration_closed'].title}` -> `{examples['registration_closed'].cta_label}`
      - Soon: `{examples['registration_soon'].title}` -> `{examples['registration_soon'].cta_label}`
      - Sold out: `{examples['sold_out'].title}` -> `{examples['sold_out'].cta_label}`

      ## Telegram note

      - Latest `/help` response: `{(summary['telegram_check']['recent_messages'][0] if summary['telegram_check']['recent_messages'] else 'no messages')}`
      - Fresh matches for `{full_name}`: `{len(summary['telegram_check']['matches'])}`
      - Consent link statuses: `{[item['status'] for item in summary['consent_links']]}`
      - Cleanup result: `{(summary['cleanup']['recent_messages'][0] if summary['cleanup']['recent_messages'] else 'no messages')}`
      """
    ).strip() + '\n',
    encoding='utf-8',
  )


if __name__ == '__main__':
  main()
