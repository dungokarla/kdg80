import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { TicketArtifacts } from '../types';

type TicketArtifactInput = {
  publicHash: string;
  shortTicketId: string;
  ticketBaseUrl: string;
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
  const ticketUrl = `${input.ticketBaseUrl}/tickets/${input.publicHash}/`;
  const pdfUrl = `${ticketUrl}ticket.pdf`;
  const icsUrl = `${ticketUrl}event.ics`;
  const formattedDate = formatEventDate(input.startsAt);

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
        <div class="actions">
          <a class="button" href="${escapeHtml(pdfUrl)}">Скачать PDF</a>
          <a class="button button--ghost" href="${escapeHtml(icsUrl)}">Скачать ICS</a>
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
    `DESCRIPTION:${`Билет № ${input.shortTicketId}. Печать не требуется. ${input.ticketBaseUrl}/tickets/${input.publicHash}/`.replace(/,/gu, '\\,')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function createPdf(filePath: string, input: TicketArtifactInput) {
  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
    });

    const stream = fs.createWriteStream(filePath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);

    doc.pipe(stream);

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
    doc.fillColor('#b83f2f').text(`Ссылка на билет: ${input.ticketBaseUrl}/tickets/${input.publicHash}/`);
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

export async function writeTicketArtifacts(baseDir: string, input: Omit<TicketArtifactInput, 'emailMasked' | 'phoneMasked'> & {
  email: string;
  phone: string;
}): Promise<TicketArtifacts> {
  const ticketDir = path.join(baseDir, 'tickets', input.publicHash);
  fs.mkdirSync(ticketDir, { recursive: true });

  const htmlInput: TicketArtifactInput = {
    ...input,
    emailMasked: maskEmail(input.email),
    phoneMasked: maskPhone(input.phone),
  };

  const ticketUrl = `${input.ticketBaseUrl}/tickets/${input.publicHash}/`;
  const pdfUrl = `${ticketUrl}ticket.pdf`;
  const icsUrl = `${ticketUrl}event.ics`;

  fs.writeFileSync(path.join(ticketDir, 'index.html'), buildHtml(htmlInput));
  fs.writeFileSync(path.join(ticketDir, 'event.ics'), buildIcs(htmlInput));
  await createPdf(path.join(ticketDir, 'ticket.pdf'), htmlInput);

  return {
    ticketUrl,
    pdfUrl,
    icsUrl,
  };
}
