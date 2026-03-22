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
};

function formatEventDate(isoValue: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
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

function buildHtml(input: TicketArtifactInput) {
  const ticketUrl = `${input.ticketBaseUrl}/${input.ticketsPrefix}/${input.publicHash}/`;
  const pdfUrl = `${ticketUrl}ticket.pdf`;
  const icsUrl = `${ticketUrl}event.ics`;
  const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
  const formattedDate = formatEventDate(input.startsAt);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
  const googleDates = `${startsAt.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')}/${endsAt.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')}`;

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
      :root {
        color-scheme: light;
        --bg: #f6efe6;
        --card: #fffaf4;
        --ink: #17120d;
        --accent: #b83f2f;
        --line: rgba(23, 18, 13, 0.12);
      }
      body {
        margin: 0;
        font-family: "Georgia", "Times New Roman", serif;
        background: radial-gradient(circle at top, #fdf8f0 0%, var(--bg) 58%, #efe2d2 100%);
        color: var(--ink);
      }
      .shell {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px 16px 56px;
      }
      .ticket {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 28px;
        box-shadow: 0 28px 80px rgba(88, 39, 16, 0.12);
      }
      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent);
        margin: 0 0 12px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 5vw, 46px);
        line-height: 0.98;
      }
      .grid {
        display: grid;
        gap: 16px;
        margin-top: 24px;
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 18px;
      }
      .label {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: rgba(23, 18, 13, 0.56);
        margin-bottom: 8px;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 24px;
      }
      .actions-title {
        margin: 24px 0 12px;
        font-size: 13px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(23, 18, 13, 0.56);
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        color: white;
        background: var(--accent);
        flex: 1 1 180px;
      }
      .button--ghost {
        color: var(--ink);
        background: transparent;
        border: 1px solid var(--line);
      }
      .note {
        margin-top: 18px;
        font-size: 14px;
        color: rgba(23, 18, 13, 0.72);
      }
      .note a {
        overflow-wrap: anywhere;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <article class="ticket">
        <p class="eyebrow">80 историй о главном</p>
        <h1>${escapeHtml(input.title)}</h1>
        <p><strong>Билет № ${escapeHtml(input.shortTicketId)}</strong></p>
        <div class="grid">
          <section class="card">
            <span class="label">Посетитель</span>
            <div>${escapeHtml(input.fullName)}</div>
            <div>${escapeHtml(input.emailMasked)}</div>
            <div>${escapeHtml(input.phoneMasked)}</div>
          </section>
          <section class="card">
            <span class="label">Событие</span>
            <div>${escapeHtml(formattedDate)}</div>
            <div>${escapeHtml(input.venueName)}</div>
            <div>${escapeHtml(input.hallName)}</div>
            <div>${escapeHtml(input.address)}</div>
          </section>
        </div>
        <p class="actions-title">Добавьте событие в календарь, чтобы не забыть</p>
        <div class="actions">
          <a class="button" href="${escapeHtml(pdfUrl)}">Скачать PDF</a>
          <a class="button button--ghost" href="${escapeHtml(googleCalendarUrl.toString())}" target="_blank" rel="noreferrer">Google Calendar</a>
          <a class="button button--ghost" href="${escapeHtml(icsUrl)}">iPhone / Apple Calendar</a>
          <a class="button button--ghost" href="${escapeHtml(icsUrl)}">Android / ICS</a>
          <a class="button button--ghost" href="${escapeHtml(icsUrl)}" download>Скачать ICS</a>
        </div>
        <p class="note">Печать билета не требуется. Рассадка свободная. Добавьте событие в календарь, чтобы не забыть.</p>
        <p class="note">Постоянная ссылка на билет: <a href="${escapeHtml(ticketUrl)}">${escapeHtml(ticketUrl)}</a></p>
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
    `DESCRIPTION:${`Билет № ${input.shortTicketId}. Печать не требуется. ${input.ticketBaseUrl}/${input.ticketsPrefix}/${input.publicHash}/`.replace(/,/gu, '\\,')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function createPdfBuffer(input: TicketArtifactInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    doc.fillColor('#b83f2f').fontSize(12).text('80 историй о главном', { characterSpacing: 2 });
    doc.moveDown(0.6);
    doc.fillColor('#17120d').fontSize(26).text(input.title);
    doc.moveDown(0.8);
    doc.fontSize(14).text(`Билет № ${input.shortTicketId}`);
    doc.moveDown(0.6);
    doc.fontSize(12).text(`Посетитель: ${input.fullName}`);
    doc.text(`Email: ${input.emailMasked}`);
    doc.text(`Телефон: ${input.phoneMasked}`);
    doc.moveDown(0.8);
    doc.text(`Дата и время: ${formatEventDate(input.startsAt)}`);
    doc.text(`Площадка: ${input.venueName}`);
    doc.text(`Зал: ${input.hallName}`);
    doc.text(`Адрес: ${input.address}`);
    doc.moveDown(0.8);
    doc.text('Рассадка свободная.');
    doc.text('Печать билета не требуется.');
    doc.moveDown(0.8);
    doc.fillColor('#b83f2f').text(`Ссылка на билет: ${input.ticketBaseUrl}/${input.ticketsPrefix}/${input.publicHash}/`);
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
