import ExcelJS from 'exceljs';
import type Database from 'better-sqlite3';
import { decryptPii } from '../lib/crypto';

type ExportRow = {
  registration_id: number;
  pii_ciphertext: Buffer;
  pii_wrapped_key: Buffer;
  pii_iv: Buffer;
  pii_alg: string;
  title: string;
  starts_at: string;
  venue_name: string;
  hall_name: string;
  address: string;
  public_url: string | null;
};

export type EventRegistrationExportRow = {
  registrationId: number;
  fullName: string;
  email: string;
  phone: string;
  emailMasked: string;
  phoneMasked: string;
  eventTitle: string;
  startsAt: string;
  venueName: string;
  hallName: string;
  address: string;
  ticketUrl: string | null;
};

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

export function listRegistrationsForEvent(
  db: Database.Database,
  privateKeyPemBase64: string,
  eventId: number,
) {
  const rows = db.prepare(`
    SELECT
      r.id AS registration_id,
      r.pii_ciphertext,
      r.pii_wrapped_key,
      r.pii_iv,
      r.pii_alg,
      e.title,
      e.starts_at,
      e.venue_name,
      e.hall_name,
      e.address,
      t.public_url
    FROM registrations r
    INNER JOIN events e ON e.id = r.event_id
    LEFT JOIN tickets t ON t.registration_id = r.id
    WHERE r.event_id = ?
    ORDER BY r.created_at ASC, r.id ASC
  `).all(eventId) as ExportRow[];

  return rows.flatMap((row) => {
    try {
      const pii = decryptPii(privateKeyPemBase64, {
        piiCiphertext: row.pii_ciphertext,
        piiWrappedKey: row.pii_wrapped_key,
        piiIv: row.pii_iv,
        piiAlg: row.pii_alg,
      });

      return [{
        registrationId: row.registration_id,
        fullName: pii.fullName ?? '',
        email: pii.email ?? '',
        phone: pii.phone ?? '',
        emailMasked: maskEmail(pii.email ?? ''),
        phoneMasked: maskPhone(pii.phone ?? ''),
        eventTitle: row.title,
        startsAt: row.starts_at,
        venueName: row.venue_name,
        hallName: row.hall_name,
        address: row.address,
        ticketUrl: row.public_url,
      } satisfies EventRegistrationExportRow];
    } catch {
      return [];
    }
  });
}

export function formatMaskedEventReport(
  event: {
    title: string;
    startsAt: string;
    venueName: string;
    hallName: string;
    seatsLeft: number;
  },
  rows: EventRegistrationExportRow[],
) {
  const header = [
    `Отчёт по событию`,
    event.title,
    `${event.venueName}, ${event.hallName}`,
    `Осталось мест: ${event.seatsLeft}`,
    '',
  ];

  if (!rows.length) {
    return [...header, 'Пока нет ни одной регистрации.'].join('\n');
  }

  const items = rows.slice(0, 20).map((row, index) => [
    `${index + 1}. ${row.fullName}`,
    `   ${row.emailMasked}`,
    `   ${row.phoneMasked}`,
  ].join('\n'));

  if (rows.length > 20) {
    items.push(`… и ещё ${rows.length - 20} регистраций.`);
  }

  return [...header, ...items].join('\n');
}

export async function buildEventXlsxBuffer(rows: EventRegistrationExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'registration-service';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Регистрации');

  sheet.columns = [
    { header: 'Название события', key: 'eventTitle', width: 48 },
    { header: 'ФИО', key: 'fullName', width: 32 },
    { header: 'Почта', key: 'email', width: 32 },
    { header: 'Телефон', key: 'phone', width: 20 },
    { header: 'Ссылка на приглашение', key: 'ticketUrl', width: 54 },
  ];

  for (const row of rows) {
    sheet.addRow({
      eventTitle: row.eventTitle,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      ticketUrl: row.ticketUrl ?? '',
    });
  }

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
