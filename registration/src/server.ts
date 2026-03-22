import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { loadConfig } from './config';
import { createDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { registerPublicApi } from './api/public';
import { registerRegistrationApi } from './api/registration';
import { createStoragePublisher } from './lib/storage';
import { syncCatalog } from './services/catalog';
import { registerTelegramBot } from './services/telegram-bot';

const config = loadConfig();
const db = createDatabase(config.sqlitePath);
const storagePublisher = createStoragePublisher({
  driver: config.storageDriver,
  publicTicketBaseUrl: config.publicTicketBaseUrl,
  ticketsPrefix: config.ticketsPrefix,
  localPublicRoot: config.localPublicRoot,
  s3Bucket: config.s3Bucket,
  s3Endpoint: config.s3Endpoint,
  s3Region: config.s3Region,
  s3AccessKeyId: config.s3AccessKeyId,
  s3SecretAccessKey: config.s3SecretAccessKey,
  s3ForcePathStyle: config.s3ForcePathStyle,
});

if (config.storageDriver === 'local') {
  fs.mkdirSync(config.localPublicRoot, { recursive: true });
}

runMigrations(db);
syncCatalog(db);

const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 64 * 1024,
});
const telegramBot = config.telegramBotToken && config.telegramWebhookSecret
  ? registerTelegramBot(app, {
      db,
      token: config.telegramBotToken,
      webhookSecret: config.telegramWebhookSecret,
      appBaseUrl: config.appBaseUrl,
      webhookPath: config.telegramWebhookPath,
    })
  : null;

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

if (config.storageDriver === 'local') {
  await app.register(fastifyStatic, {
    root: config.localPublicRoot,
    prefix: '/',
    wildcard: true,
    decorateReply: false,
  });
}

app.get('/api/v1/health', async () => {
  return {
    ok: true,
    service: 'registration',
    appBaseUrl: config.appBaseUrl,
    storageDriver: storagePublisher.driver,
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
  ticketsPrefix: config.ticketsPrefix,
  storagePublisher,
});

await app.listen({
  host: config.host,
  port: config.port,
});

if (telegramBot) {
  await telegramBot.ensureWebhook();
}
