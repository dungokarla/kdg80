import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import type { RegistrationPayload } from '../types';
import { createRegistration, RegistrationError } from '../services/registrations';
import { listPublicEventStates } from '../services/catalog';

type RegistrationApiDeps = {
  db: Database.Database;
  consentVersion: string;
  consentTextHash: string;
  fingerprintSecret: string | null;
  publicKeyPemBase64: string | null;
  publicTicketBaseUrl: string;
  dataRoot: string;
};

export async function registerRegistrationApi(app: FastifyInstance, deps: RegistrationApiDeps) {
  app.get('/api/v1/public/events/:slug', async (request, reply) => {
    const slug = (request.params as Record<string, string>).slug;
    const event = listPublicEventStates(deps.db, [slug])[0];

    if (!event) {
      reply.code(404);
      return {
        error: 'event_not_found',
      };
    }

    return event;
  });

  app.post('/api/v1/register', async (request, reply) => {
    if (!deps.fingerprintSecret || !deps.publicKeyPemBase64) {
      reply.code(503);
      return {
        error: 'registration_not_ready',
        message: 'Регистрация пока не настроена на сервере.',
      };
    }

    try {
      const payload = request.body as RegistrationPayload;
      const created = await createRegistration(payload, {
        db: deps.db,
        consentVersion: deps.consentVersion,
        consentTextHash: deps.consentTextHash,
        fingerprintSecret: deps.fingerprintSecret,
        publicKeyPemBase64: deps.publicKeyPemBase64,
        publicTicketBaseUrl: deps.publicTicketBaseUrl,
        dataRoot: deps.dataRoot,
        sourceIp: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.code(201);
      return created;
    } catch (error) {
      if (error instanceof RegistrationError) {
        reply.code(error.statusCode);
        return {
          error: error.code,
          message: error.message,
        };
      }

      request.log.error({ err: error }, 'registration_failed');
      reply.code(500);
      return {
        error: 'server_error',
        message: 'Не удалось завершить регистрацию. Попробуйте ещё раз чуть позже.',
      };
    }
  });
}
