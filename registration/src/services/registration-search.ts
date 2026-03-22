import type Database from 'better-sqlite3';
import { decryptPii } from '../lib/crypto';

type SearchRow = {
  id: number;
  pii_ciphertext: Buffer;
  pii_wrapped_key: Buffer;
  pii_iv: Buffer;
  pii_alg: string;
  created_at: string;
  title: string;
  starts_at: string;
  public_url: string | null;
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

export function searchRegistrationsByFullName(
  db: Database.Database,
  privateKeyPemBase64: string,
  query: string,
) {
  const normalizedQuery = query.trim().replace(/\s+/gu, ' ').toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const rows = db.prepare(`
    SELECT
      r.id,
      r.pii_ciphertext,
      r.pii_wrapped_key,
      r.pii_iv,
      r.pii_alg,
      r.created_at,
      e.title,
      e.starts_at,
      t.public_url
    FROM registrations r
    INNER JOIN events e ON e.id = r.event_id
    LEFT JOIN tickets t ON t.registration_id = r.id
    ORDER BY r.created_at DESC
    LIMIT 250
  `).all() as SearchRow[];

  const results: Array<{
    registrationId: number;
    fullName: string;
    emailMasked: string;
    phoneMasked: string;
    eventTitle: string;
    startsAt: string;
    ticketUrl: string | null;
  }> = [];

  for (const row of rows) {
    let pii: Record<string, string>;

    try {
      pii = decryptPii(privateKeyPemBase64, {
        piiCiphertext: row.pii_ciphertext,
        piiWrappedKey: row.pii_wrapped_key,
        piiIv: row.pii_iv,
        piiAlg: row.pii_alg,
      });
    } catch {
      continue;
    }

    const fullName = (pii.fullName ?? '').trim().replace(/\s+/gu, ' ');
    if (!fullName.toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    results.push({
      registrationId: row.id,
      fullName,
      emailMasked: maskEmail(pii.email ?? ''),
      phoneMasked: maskPhone(pii.phone ?? ''),
      eventTitle: row.title,
      startsAt: row.starts_at,
      ticketUrl: row.public_url,
    });

    if (results.length >= 10) {
      break;
    }
  }

  return results;
}
