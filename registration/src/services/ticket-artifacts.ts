import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { TicketArtifacts } from '../types';
import type { StoragePublisher, TicketArtifactBundle } from '../lib/storage';

type TicketArtifactInput = {
  publicHash: string;
  shortTicketId: string;
  ticketBaseUrl: string;
  ticketsPrefix: string;
  fullName: string;
  emailMasked: string;
  phoneMasked: string;
  title: string;
  startsAt: string;
  venueName: string;
  hallName: string;
  address: string;
  eventImageUrl?: string | null;
  ticketImageAsset?: string | null;
};

const ASSETS_ROOT = fileURLToPath(new URL('../assets/', import.meta.url));
const FESTIVAL_LOGO_PNG = path.join(ASSETS_ROOT, 'logos', 'logo-znanie-festival.png');
const FESTIVAL_MARK_PNG = path.join(ASSETS_ROOT, 'logos', 'logo-80-istorii-hero.png');
const TICKET_IMAGES_DIR = path.join(ASSETS_ROOT, 'ticket-event-images');
const PDF_FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const PDF_FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '');
}

function buildTicketUrl(baseUrl: string, ticketsPrefix: string, publicHash: string) {
  return `${trimTrailingSlash(baseUrl)}/${ticketsPrefix.replace(/^\/+|\/+$/gu, '')}/${publicHash}/`;
}

function formatEventDate(isoValue: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Kaliningrad',
  }).format(new Date(isoValue));
}

function formatEventDateOnly(isoValue: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeZone: 'Europe/Kaliningrad',
  }).format(new Date(isoValue));
}

function formatEventTimeOnly(isoValue: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeStyle: 'short',
    timeZone: 'Europe/Kaliningrad',
  }).format(new Date(isoValue));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function buildAbsoluteUrl(baseUrl: string, relativePath: string | null | undefined) {
  if (!relativePath) {
    return null;
  }

  if (/^https?:\/\//u.test(relativePath)) {
    return relativePath;
  }

  return `${trimTrailingSlash(baseUrl)}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

function resolveTicketImagePath(assetName: string | null | undefined) {
  if (!assetName) {
    return null;
  }

  const absolutePath = path.join(TICKET_IMAGES_DIR, assetName);
  return fs.existsSync(absolutePath) ? absolutePath : null;
}

function buildHtml(input: TicketArtifactInput) {
  const ticketUrl = buildTicketUrl(input.ticketBaseUrl, input.ticketsPrefix, input.publicHash);
  const pdfUrl = `${ticketUrl}ticket.pdf`;
  const icsUrl = `${ticketUrl}event.ics`;
  const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
  const formattedDate = formatEventDate(input.startsAt);
  const dateOnly = formatEventDateOnly(input.startsAt);
  const timeOnly = formatEventTimeOnly(input.startsAt);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
  const googleDates = `${startsAt.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')}/${endsAt.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')}`;
  const festivalLogoUrl = '/shared-assets/logo-znanie-festival.svg';
  const festivalMarkUrl = '/shared-assets/logo-80-istorii-hero.svg';
  const eventImageUrl = input.eventImageUrl || '';

  googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
  googleCalendarUrl.searchParams.set('text', input.title);
  googleCalendarUrl.searchParams.set('dates', googleDates);
  googleCalendarUrl.searchParams.set('location', `${input.venueName}, ${input.address}`);
  googleCalendarUrl.searchParams.set('details', `Билет № ${input.shortTicketId}. Печать не требуется. ${ticketUrl}`);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow, noarchive" />
    <title>Билет — ${escapeHtml(input.title)}</title>
    <style>
      @font-face {
        font-family: "Cygre";
        src: url("/shared-assets/fonts/Cygre-Regular.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "Cygre";
        src: url("/shared-assets/fonts/Cygre-Bold.woff2") format("woff2");
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "FavoritPro";
        src: url("/shared-assets/fonts/FavoritPro-Book.otf") format("opentype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "FavoritPro";
        src: url("/shared-assets/fonts/FavoritPro-Medium.otf") format("opentype");
        font-weight: 500;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "FavoritPro";
        src: url("/shared-assets/fonts/FavoritPro-Bold.otf") format("opentype");
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }

      :root {
        color-scheme: light;
        --paper: #f5ede1;
        --paper-soft: #fbf5ec;
        --card: rgba(255, 250, 244, 0.92);
        --ink: #16120d;
        --ink-soft: rgba(22, 18, 13, 0.68);
        --line: rgba(22, 18, 13, 0.12);
        --accent: #d84b31;
        --accent-deep: #962d1b;
        --shadow: 0 24px 64px rgba(27, 18, 12, 0.16);
        --radius-lg: 30px;
        --radius-md: 20px;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "FavoritPro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 12% 0%, rgba(216, 75, 49, 0.18), transparent 22rem),
          radial-gradient(circle at 84% 8%, rgba(18, 17, 14, 0.1), transparent 24rem),
          linear-gradient(180deg, #f7f1e8 0%, var(--paper) 44%, #f0e4d4 100%);
      }

      .shell {
        width: min(100% - 1.25rem, 980px);
        margin: 0 auto;
        padding: 24px 0 56px;
      }

      .ticket {
        overflow: hidden;
        border-radius: var(--radius-lg);
        background: var(--card);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }

      .hero {
        display: grid;
        gap: 24px;
        padding: 28px 28px 0;
      }

      .hero__brand {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .hero__logos {
        display: grid;
        gap: 10px;
      }

      .hero__logos img:first-child {
        width: clamp(170px, 38vw, 320px);
        height: auto;
      }

      .hero__logos img:last-child {
        width: clamp(78px, 20vw, 132px);
        height: auto;
      }

      .hero__eyebrow {
        margin: 0;
        color: var(--accent-deep);
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .hero__badge {
        display: inline-flex;
        align-items: center;
        min-height: 40px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid rgba(150, 45, 27, 0.15);
        background: rgba(216, 75, 49, 0.1);
        color: var(--accent-deep);
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .hero__title {
        margin: 0;
        font-family: "Cygre", "Helvetica Neue", Arial, sans-serif;
        font-size: clamp(34px, 6vw, 62px);
        line-height: 0.92;
        letter-spacing: -0.03em;
        max-width: 11ch;
      }

      .hero__summary {
        margin: 0;
        max-width: 58ch;
        color: var(--ink-soft);
        font-size: 17px;
        line-height: 1.55;
      }

      .hero__meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .hero__stat {
        padding: 14px 16px;
        border-radius: var(--radius-md);
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid var(--line);
      }

      .hero__stat-label {
        display: block;
        margin-bottom: 6px;
        color: rgba(22, 18, 13, 0.52);
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .hero__stat-value {
        font-size: 16px;
        line-height: 1.35;
      }

      .hero__image {
        position: relative;
        min-height: 240px;
        margin-top: 4px;
        border-radius: 24px;
        overflow: hidden;
        background:
          linear-gradient(135deg, rgba(216, 75, 49, 0.28), rgba(24, 18, 14, 0.1)),
          #e9d8c4;
      }

      .hero__image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .hero__image::after {
        content: "";
        position: absolute;
        inset: auto 0 0;
        height: 46%;
        background: linear-gradient(180deg, rgba(22, 18, 13, 0) 0%, rgba(22, 18, 13, 0.82) 100%);
      }

      .hero__image-caption {
        position: absolute;
        left: 18px;
        right: 18px;
        bottom: 18px;
        z-index: 1;
        color: white;
      }

      .hero__image-caption strong {
        display: block;
        font-family: "Cygre", "Helvetica Neue", Arial, sans-serif;
        font-size: clamp(24px, 4vw, 36px);
        line-height: 0.94;
        letter-spacing: -0.03em;
      }

      .hero__image-caption span {
        display: block;
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.84);
        font-size: 14px;
        line-height: 1.45;
      }

      .body {
        display: grid;
        grid-template-columns: 1.25fr 0.95fr;
        gap: 18px;
        padding: 24px 28px 28px;
      }

      .panel {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
        padding: 20px;
      }

      .panel__label {
        display: block;
        margin-bottom: 10px;
        color: rgba(22, 18, 13, 0.52);
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .panel__value {
        margin: 0;
        font-size: 18px;
        line-height: 1.5;
      }

      .panel__value--person {
        font-family: "Cygre", "Helvetica Neue", Arial, sans-serif;
        font-size: clamp(26px, 4vw, 38px);
        line-height: 0.98;
      }

      .ticket-id {
        display: inline-flex;
        align-items: center;
        min-height: 56px;
        padding: 0 18px;
        border-radius: 20px;
        background: #17120d;
        color: white;
        font-family: "Cygre", "Helvetica Neue", Arial, sans-serif;
        font-size: clamp(26px, 5vw, 38px);
        letter-spacing: 0.1em;
      }

      .ticket-id-note {
        margin: 12px 0 0;
        color: var(--ink-soft);
        font-size: 15px;
        line-height: 1.45;
      }

      .actions-stack {
        display: grid;
        gap: 16px;
      }

      .calendar-block {
        padding: 18px;
        border-radius: 24px;
        border: 1px solid rgba(150, 45, 27, 0.14);
        background: linear-gradient(180deg, rgba(255, 250, 244, 0.96) 0%, rgba(247, 239, 228, 0.96) 100%);
      }

      .actions-title {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(22, 18, 13, 0.52);
      }

      .actions-copy {
        margin: 0;
        color: var(--ink-soft);
        font-size: 15px;
        line-height: 1.5;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .actions--calendar {
        margin-top: 18px;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: var(--accent);
        color: white;
        text-decoration: none;
        font-weight: 700;
        flex: 1 1 210px;
        box-shadow: 0 12px 30px rgba(150, 45, 27, 0.16);
      }

      .button--ghost {
        color: var(--ink);
        background: rgba(255, 255, 255, 0.88);
        border-color: rgba(22, 18, 13, 0.1);
        box-shadow: 0 10px 24px rgba(22, 18, 13, 0.08);
      }

      .footer-note {
        margin: 18px 0 0;
        color: var(--ink-soft);
        font-size: 14px;
        line-height: 1.55;
      }

      .footer-note a {
        color: inherit;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      @media (max-width: 860px) {
        .hero__meta,
        .body {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .shell {
          width: min(100% - 0.75rem, 980px);
          padding-top: 12px;
        }

        .ticket {
          border-radius: 24px;
        }

        .hero,
        .body {
          padding-left: 18px;
          padding-right: 18px;
        }

        .hero {
          gap: 18px;
        }

        .hero__brand {
          gap: 12px;
        }

        .hero__image {
          min-height: 204px;
        }

        .panel__value {
          font-size: 16px;
        }

        .button {
          flex-basis: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <article class="ticket">
        <section class="hero">
          <div class="hero__brand">
            <div class="hero__logos">
              <img src="${festivalLogoUrl}" alt="Российское общество Знание. Фестиваль 80 историй о главном" />
              <img src="${festivalMarkUrl}" alt="" aria-hidden="true" />
            </div>
            <span class="hero__badge">Билет / Приглашение</span>
          </div>
          <p class="hero__eyebrow">80 историй о главном</p>
          <h1 class="hero__title">${escapeHtml(input.title)}</h1>
          <p class="hero__summary">Сохраните эту страницу или скачайте PDF. Печать билета не требуется, а свободная рассадка позволит спокойно занять удобное место перед началом события.</p>
          <div class="hero__meta">
            <div class="hero__stat">
              <span class="hero__stat-label">Дата</span>
              <div class="hero__stat-value">${escapeHtml(dateOnly)}</div>
            </div>
            <div class="hero__stat">
              <span class="hero__stat-label">Время</span>
              <div class="hero__stat-value">${escapeHtml(timeOnly)}</div>
            </div>
            <div class="hero__stat">
              <span class="hero__stat-label">Площадка</span>
              <div class="hero__stat-value">${escapeHtml(input.venueName)}</div>
            </div>
            <div class="hero__stat">
              <span class="hero__stat-label">Зал</span>
              <div class="hero__stat-value">${escapeHtml(input.hallName)}</div>
            </div>
          </div>
          <figure class="hero__image">
            ${eventImageUrl ? `<img src="${escapeHtml(eventImageUrl)}" alt="Визуальный образ события «${escapeHtml(input.title)}»" />` : ''}
            <figcaption class="hero__image-caption">
              <strong>Билет № ${escapeHtml(input.shortTicketId)}</strong>
              <span>${escapeHtml(formattedDate)} · ${escapeHtml(input.address)}</span>
            </figcaption>
          </figure>
        </section>

        <section class="body">
          <div class="panel">
            <span class="panel__label">Посетитель</span>
            <p class="panel__value panel__value--person">${escapeHtml(input.fullName)}</p>
            <p class="panel__value">${escapeHtml(input.emailMasked)}<br />${escapeHtml(input.phoneMasked)}</p>
          </div>
          <div class="panel">
            <span class="panel__label">Короткий номер билета</span>
            <div class="ticket-id">${escapeHtml(input.shortTicketId)}</div>
            <p class="ticket-id-note">Покажите этот номер или откройте билет со страницы мероприятия. Рассадка свободная.</p>
          </div>
          <div class="panel">
            <span class="panel__label">Маршрут</span>
            <p class="panel__value">${escapeHtml(input.venueName)}<br />${escapeHtml(input.hallName)}<br />${escapeHtml(input.address)}</p>
          </div>
          <div class="panel">
            <div class="actions-stack">
              <a class="button" href="${escapeHtml(pdfUrl)}">Скачать PDF</a>
              <div class="calendar-block">
                <p class="actions-title">📅 Добавить в календарь</p>
                <p class="actions-copy">Добавьте событие сейчас, чтобы не искать билет в день мероприятия.</p>
                <div class="actions actions--calendar">
                  <a class="button button--ghost" href="${escapeHtml(icsUrl)}">Android (ICS)</a>
                  <a class="button button--ghost" href="${escapeHtml(icsUrl)}">Календарь Apple</a>
                  <a class="button button--ghost" href="${escapeHtml(googleCalendarUrl.toString())}" target="_blank" rel="noreferrer">Google</a>
                </div>
              </div>
            </div>
            <p class="footer-note">Печать билета не требуется. Свободная рассадка. Постоянная ссылка на билет: <a href="${escapeHtml(ticketUrl)}">${escapeHtml(ticketUrl)}</a></p>
          </div>
        </section>
      </article>
    </main>
  </body>
</html>`;
}

function buildIcs(input: TicketArtifactInput) {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + 90 * 60_000);
  const stamp = new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  const startIcs = start.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  const endIcs = end.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  const ticketUrl = buildTicketUrl(input.ticketBaseUrl, input.ticketsPrefix, input.publicHash);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//80 историй о главном//Registration Ticket//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.publicHash}@80istoriy.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startIcs}`,
    `DTEND:${endIcs}`,
    `SUMMARY:${input.title.replace(/,/gu, '\\,')}`,
    `LOCATION:${`${input.venueName}, ${input.address}`.replace(/,/gu, '\\,')}`,
    `DESCRIPTION:${`Билет № ${input.shortTicketId}. Печать не требуется. Свободная рассадка. ${ticketUrl}`.replace(/,/gu, '\\,')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function setPdfFont(doc: PDFKit.PDFDocument, fontPath: string, fallback: string) {
  if (fs.existsSync(fontPath)) {
    doc.font(fontPath);
    return;
  }

  doc.font(fallback);
}

function setPdfRegularFont(doc: PDFKit.PDFDocument) {
  setPdfFont(doc, PDF_FONT_REGULAR, 'Helvetica');
}

function setPdfBoldFont(doc: PDFKit.PDFDocument) {
  setPdfFont(doc, PDF_FONT_BOLD, 'Helvetica-Bold');
}

function drawInfoCard(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value: string;
  },
) {
  doc.save();
  doc.roundedRect(options.x, options.y, options.width, options.height, 18).fillAndStroke('#fffaf4', '#e4d7c6');
  doc.fillColor('#7a7066');
  setPdfBoldFont(doc);
  doc.fontSize(10).text(options.label.toUpperCase(), options.x + 14, options.y + 14, {
    width: options.width - 28,
    characterSpacing: 1.2,
  });
  doc.fillColor('#16120d');
  setPdfRegularFont(doc);
  doc.fontSize(12).text(options.value, options.x + 14, options.y + 34, {
    width: options.width - 28,
    lineGap: 3,
  });
  doc.restore();
}

function createPdfBuffer(input: TicketArtifactInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: `Билет — ${input.title}`,
        Author: '80 историй о главном',
      },
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentX = 42;
    const contentWidth = pageWidth - contentX * 2;
    const ticketUrl = buildTicketUrl(input.ticketBaseUrl, input.ticketsPrefix, input.publicHash);
    doc.rect(0, 0, pageWidth, pageHeight).fill('#f5ede1');
    doc.save();
    doc.fillColor('#d84b31').circle(pageWidth - 88, 86, 82).fill();
    doc.restore();
    doc.save();
    doc.fillColor('#18120e').circle(94, pageHeight - 96, 70).fillOpacity(0.08).fill();
    doc.restore();

    if (fs.existsSync(FESTIVAL_LOGO_PNG)) {
      doc.image(FESTIVAL_LOGO_PNG, contentX, 36, { fit: [290, 50] });
    }

    if (fs.existsSync(FESTIVAL_MARK_PNG)) {
      doc.image(FESTIVAL_MARK_PNG, pageWidth - 150, 30, { fit: [92, 92] });
    }

    doc.save();
    doc.roundedRect(contentX, 106, 138, 30, 15).fill('#f3d6d0');
    doc.fillColor('#962d1b');
    setPdfBoldFont(doc);
    doc.fontSize(11).text('БИЛЕТ / ПРИГЛАШЕНИЕ', contentX + 14, 116, {
      width: 110,
      characterSpacing: 1.2,
    });
    doc.restore();

    setPdfBoldFont(doc);
    doc.fillColor('#16120d');
    doc.fontSize(28).text(input.title, contentX, 154, {
      width: contentWidth * 0.72,
      lineGap: -1,
    });

    setPdfRegularFont(doc);
    doc.fillColor('#544b42');
    doc.fontSize(13).text(
      'Сохраните этот билет в телефоне. Печать не требуется, а свободная рассадка позволит спокойно занять удобное место перед началом события.',
      contentX,
      242,
      {
        width: contentWidth * 0.7,
        lineGap: 4,
      },
    );

    const heroY = 320;
    const heroHeight = 192;
    doc.save();
    doc.roundedRect(contentX, heroY, contentWidth, heroHeight, 28).fillAndStroke('#f8f0e6', '#dbcdbb');
    doc.restore();
    doc.save();
    doc.roundedRect(contentX + 18, heroY + 18, contentWidth - 36, heroHeight - 36, 22).fill('#17120d');
    doc.restore();

    if (fs.existsSync(FESTIVAL_LOGO_PNG)) {
      doc.image(FESTIVAL_LOGO_PNG, contentX + 26, heroY + 28, { fit: [220, 38] });
    }

    if (fs.existsSync(FESTIVAL_MARK_PNG)) {
      doc.image(FESTIVAL_MARK_PNG, pageWidth - 136, heroY + 18, { fit: [84, 84] });
    }

    setPdfBoldFont(doc);
    doc.fillColor('#f0e6d7');
    doc.fontSize(11).text('ФЕСТИВАЛЬНЫЙ БИЛЕТ', contentX + 26, heroY + 82, {
      width: contentWidth - 52,
      characterSpacing: 1.5,
    });

    setPdfBoldFont(doc);
    doc.fillColor('#ffffff');
    doc.fontSize(30).text(`Билет № ${input.shortTicketId}`, contentX + 26, heroY + 104, {
      width: contentWidth - 160,
      lineGap: 0,
    });

    setPdfRegularFont(doc);
    doc.fillColor('#d7ccc0');
    doc.fontSize(12).text(
      `${formatEventDate(input.startsAt)} · ${input.venueName}`,
      contentX + 26,
      heroY + 146,
      {
        width: contentWidth - 52,
        lineGap: 3,
      },
    );

    doc.fontSize(11).text(
      'Билет собран в облегчённом PDF-формате: логотипы и данные события сохраняются надёжно даже под нагрузкой.',
      contentX + 26,
      heroY + 166,
      {
        width: contentWidth - 150,
        lineGap: 3,
      },
    );

    const cardsY = heroY + heroHeight + 22;
    const cardGap = 14;
    const smallCardWidth = (contentWidth - cardGap * 3) / 4;

    drawInfoCard(doc, {
      x: contentX,
      y: cardsY,
      width: smallCardWidth,
      height: 86,
      label: 'Дата',
      value: formatEventDateOnly(input.startsAt),
    });
    drawInfoCard(doc, {
      x: contentX + smallCardWidth + cardGap,
      y: cardsY,
      width: smallCardWidth,
      height: 86,
      label: 'Время',
      value: formatEventTimeOnly(input.startsAt),
    });
    drawInfoCard(doc, {
      x: contentX + (smallCardWidth + cardGap) * 2,
      y: cardsY,
      width: smallCardWidth,
      height: 86,
      label: 'Площадка',
      value: input.venueName,
    });
    drawInfoCard(doc, {
      x: contentX + (smallCardWidth + cardGap) * 3,
      y: cardsY,
      width: smallCardWidth,
      height: 86,
      label: 'Зал',
      value: input.hallName,
    });

    const lowerY = cardsY + 102;
    const leftWidth = contentWidth * 0.58;
    const rightX = contentX + leftWidth + cardGap;
    const rightWidth = contentWidth - leftWidth - cardGap;

    doc.save();
    doc.roundedRect(contentX, lowerY, leftWidth, 122, 22).fillAndStroke('#fffaf4', '#e4d7c6');
    doc.restore();
    doc.fillColor('#7a7066');
    setPdfBoldFont(doc);
    doc.fontSize(10).text('ПОСЕТИТЕЛЬ', contentX + 18, lowerY + 16, {
      width: leftWidth - 36,
      characterSpacing: 1.2,
    });
    doc.fillColor('#16120d');
    setPdfBoldFont(doc);
    doc.fontSize(24).text(input.fullName, contentX + 18, lowerY + 36, {
      width: leftWidth - 36,
      lineGap: 2,
    });
    setPdfRegularFont(doc);
    doc.fillColor('#544b42');
    doc.fontSize(12).text(`${input.emailMasked}\n${input.phoneMasked}`, contentX + 18, lowerY + 84, {
      width: leftWidth - 36,
      lineGap: 3,
    });

    doc.save();
    doc.roundedRect(rightX, lowerY, rightWidth, 122, 22).fillAndStroke('#18120e', '#18120e');
    doc.restore();
    doc.fillColor('#f5ede1');
    setPdfBoldFont(doc);
    doc.fontSize(10).text('КОРОТКИЙ НОМЕР БИЛЕТА', rightX + 18, lowerY + 16, {
      width: rightWidth - 36,
      characterSpacing: 1.2,
    });
    setPdfBoldFont(doc);
    doc.fontSize(31).text(input.shortTicketId, rightX + 18, lowerY + 42, {
      width: rightWidth - 36,
      characterSpacing: 4,
    });
    setPdfRegularFont(doc);
    doc.fontSize(11).text('Свободная рассадка. Достаточно открыть этот билет на телефоне.', rightX + 18, lowerY + 88, {
      width: rightWidth - 36,
      lineGap: 3,
    });

    const footerY = lowerY + 142;
    doc.fillColor('#16120d');
    setPdfBoldFont(doc);
    doc.fontSize(13).text('Полный адрес площадки', contentX, footerY);
    setPdfRegularFont(doc);
    doc.fillColor('#544b42');
    doc.fontSize(12).text(`${input.venueName}, ${input.hallName}\n${input.address}`, contentX, footerY + 18, {
      width: contentWidth * 0.56,
      lineGap: 4,
    });

    setPdfBoldFont(doc);
    doc.fillColor('#16120d');
    doc.fontSize(13).text('На странице билета есть блок "Добавить в календарь"', rightX, footerY);
    setPdfRegularFont(doc);
    doc.fillColor('#544b42');
    doc.fontSize(12).text('Кнопки: Android (ICS), Календарь Apple и Google.', rightX, footerY + 18, {
      width: rightWidth,
      lineGap: 4,
    });

    doc.fillColor('#962d1b');
    doc.fontSize(11).text(`Ссылка на билет: ${ticketUrl}`, contentX, pageHeight - 62, {
      width: contentWidth,
      lineGap: 3,
    });
    doc.fillColor('#544b42');
    doc.fontSize(11).text('Печать билета не требуется.', contentX, pageHeight - 36);

    doc.end();
  });
}

function maskEmail(email: string) {
  const [local, domain = ''] = email.split('@');
  const safeLocal = local.length <= 2 ? `${local[0] ?? '*'}*` : `${local.slice(0, 2)}***`;
  const [domainName, domainZone = ''] = domain.split('.');
  const safeDomain = domainName.length <= 2 ? `${domainName[0] ?? '*'}*` : `${domainName.slice(0, 2)}***`;
  return `${safeLocal}@${safeDomain}${domainZone ? `.${domainZone}` : ''}`;
}

function maskPhone(phone: string) {
  return phone.replace(/^(\+7)(\d{3})(\d{3})(\d{2})(\d{2})$/u, '$1 $2 ***-**-$5');
}

export async function publishTicketArtifacts(
  publisher: StoragePublisher,
  input: {
    publicHash: string;
    shortTicketId: string;
    ticketBaseUrl: string;
    ticketsPrefix: string;
    fullName: string;
    email: string;
    phone: string;
    title: string;
    startsAt: string;
    venueName: string;
    hallName: string;
    address: string;
    eventImageUrl?: string | null;
    ticketImageAsset?: string | null;
  },
): Promise<TicketArtifacts> {
  const htmlInput: TicketArtifactInput = {
    publicHash: input.publicHash,
    shortTicketId: input.shortTicketId,
    ticketBaseUrl: input.ticketBaseUrl,
    ticketsPrefix: input.ticketsPrefix,
    fullName: input.fullName,
    emailMasked: maskEmail(input.email),
    phoneMasked: maskPhone(input.phone),
    title: input.title,
    startsAt: input.startsAt,
    venueName: input.venueName,
    hallName: input.hallName,
    address: input.address,
    eventImageUrl: buildAbsoluteUrl(input.ticketBaseUrl, input.eventImageUrl ?? null),
    ticketImageAsset: input.ticketImageAsset ?? null,
  };

  const bundle: TicketArtifactBundle = {
    publicHash: input.publicHash,
    files: [
      {
        key: `${input.ticketsPrefix}/${input.publicHash}/index.html`,
        body: buildHtml(htmlInput),
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-store, max-age=0',
      },
      {
        key: `${input.ticketsPrefix}/${input.publicHash}/event.ics`,
        body: buildIcs(htmlInput),
        contentType: 'text/calendar; charset=utf-8',
        cacheControl: 'public, max-age=300',
      },
      {
        key: `${input.ticketsPrefix}/${input.publicHash}/ticket.pdf`,
        body: await createPdfBuffer(htmlInput),
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=300',
      },
    ],
  };

  return publisher.publishTicketArtifacts(bundle);
}
