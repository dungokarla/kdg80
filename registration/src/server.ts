import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config';
import { createDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { registerPublicApi } from './api/public';
import { registerRegistrationApi } from './api/registration';
import { syncCatalog } from './services/catalog';

const config = loadConfig();
const db = createDatabase(config.sqlitePath);
const publicRoot = path.resolve(process.cwd(), 'data', 'public');

fs.mkdirSync(publicRoot, { recursive: true });

runMigrations(db);
syncCatalog(db);

const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 64 * 1024,
});

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalized = origin.replace(/\/+$/u, '');
    const allowed = config.allowedOrigins.includes(normalized);
    callback(null, allowed);
  },
});

await app.register(rateLimit, {
  max: 120,
  timeWindow: '1 minute',
});

await app.register(fastifyStatic, {
  root: publicRoot,
  prefix: '/',
  wildcard: true,
  decorateReply: false,
});

app.get('/api/v1/health', async () => {
  return {
    ok: true,
    service: 'registration',
    appBaseUrl: config.appBaseUrl,
  };
});

await registerPublicApi(app, db);
await registerRegistrationApi(app, {
  db,
  consentVersion: config.consentVersion,
  consentTextHash: config.consentTextHash,
  fingerprintSecret: config.piiFingerprintSecret,
  publicKeyPemBase64: config.piiPublicKeyPemBase64,
  publicTicketBaseUrl: config.publicTicketBaseUrl,
  dataRoot: path.resolve(process.cwd(), 'data'),
});

await app.listen({
  host: config.host,
  port: config.port,
});
