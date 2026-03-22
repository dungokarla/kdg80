import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { listPublicEventStates } from '../services/catalog';

export async function registerPublicApi(app: FastifyInstance, db: Database.Database) {
  app.get('/api/v1/public/events/states', async (request) => {
    const rawSlugs = typeof request.query === 'object' && request.query
      ? (request.query as Record<string, unknown>).slugs
      : undefined;

    const slugs = typeof rawSlugs === 'string'
      ? rawSlugs.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    return {
      items: listPublicEventStates(db, slugs),
    };
  });
}
