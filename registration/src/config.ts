import path from 'node:path';

type AppConfig = {
  host: string;
  port: number;
  appBaseUrl: string;
  publicSiteBaseUrl: string;
  publicTicketBaseUrl: string;
  sqlitePath: string;
  allowedOrigins: string[];
  consentVersion: string;
  consentTextHash: string;
  piiPublicKeyPemBase64: string | null;
  piiFingerprintSecret: string | null;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '');
}

function parsePort(value: string | undefined, fallback: number) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function parseOrigins(value: string | undefined, fallback: string) {
  return (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(trimTrailingSlash);
}

export function loadConfig(): AppConfig {
  const host = process.env.HOST?.trim() || '0.0.0.0';
  const port = parsePort(process.env.PORT, 3001);
  const appBaseUrl = trimTrailingSlash(process.env.APP_BASE_URL?.trim() || `http://localhost:${port}`);
  const publicSiteBaseUrl = trimTrailingSlash(process.env.PUBLIC_SITE_BASE_URL?.trim() || 'http://localhost:4321');
  const publicTicketBaseUrl = trimTrailingSlash(process.env.PUBLIC_TICKET_BASE_URL?.trim() || appBaseUrl);
  const sqlitePath = path.resolve(process.cwd(), process.env.SQLITE_PATH?.trim() || './data/registration.sqlite');
  const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS, publicSiteBaseUrl);
  const consentVersion = process.env.CONSENT_VERSION?.trim() || 'draft-1';
  const consentTextHash = process.env.CONSENT_TEXT_HASH?.trim() || 'dev-draft';
  const piiPublicKeyPemBase64 = process.env.PII_PUBLIC_KEY_PEM_B64?.trim() || null;
  const piiFingerprintSecret = process.env.PII_FINGERPRINT_SECRET?.trim() || null;

  return {
    host,
    port,
    appBaseUrl,
    publicSiteBaseUrl,
    publicTicketBaseUrl,
    sqlitePath,
    allowedOrigins,
    consentVersion,
    consentTextHash,
    piiPublicKeyPemBase64,
    piiFingerprintSecret,
  };
}
