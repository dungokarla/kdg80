import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';

export async function createSqliteBackup(db: Database.Database, prefix = 'registration-backup') {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'registration-backup-'));
  const targetPath = path.join(tmpDir, `${prefix}.sqlite`);

  if (typeof db.backup === 'function') {
    await db.backup(targetPath);
  } else {
    throw new Error('SQLite backup API is not available in this runtime.');
  }

  const buffer = await fs.readFile(targetPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
  return buffer;
}

export async function cleanupTestRun(
  db: Database.Database,
  options: {
    testRunId: string;
    localPublicRoot?: string;
    ticketsPrefix?: string;
  },
) {
  const rows = db.prepare(`
    SELECT r.id AS registration_id, r.event_id, t.public_hash
    FROM registrations r
    LEFT JOIN tickets t ON t.registration_id = r.id
    WHERE r.test_run_id = ?
  `).all(options.testRunId) as Array<{
    registration_id: number;
    event_id: number;
    public_hash: string | null;
  }>;

  if (!rows.length) {
    return {
      removedRegistrations: 0,
      affectedEvents: 0,
    };
  }

  const affectedEventIds = Array.from(new Set(rows.map((row) => row.event_id)));
  const ticketHashes = rows.map((row) => row.public_hash).filter(Boolean) as string[];
  const deleteOutboxRow = db.prepare('DELETE FROM telegram_outbox WHERE payload_json LIKE ?');

  const apply = db.transaction(() => {
    for (const row of rows) {
      deleteOutboxRow.run(`%"registrationId":${row.registration_id}%`);
    }

    db.prepare('DELETE FROM registrations WHERE test_run_id = ?').run(options.testRunId);

    for (const eventId of affectedEventIds) {
      db.prepare(`
        UPDATE events
        SET seats_taken = (
          SELECT COUNT(*)
          FROM registrations
          WHERE event_id = ?
        ),
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ?
      `).run(eventId, eventId);
    }
  });

  apply();

  if (options.localPublicRoot && options.ticketsPrefix) {
    for (const publicHash of ticketHashes) {
      const ticketDir = path.join(options.localPublicRoot, options.ticketsPrefix, publicHash);
      await fs.rm(ticketDir, { recursive: true, force: true });
    }
  }

  return {
    removedRegistrations: rows.length,
    affectedEvents: affectedEventIds.length,
  };
}
