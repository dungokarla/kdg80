import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src', 'db', 'migrations');

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{ version: string }>;
  const applied = new Set(appliedRows.map((row) => row.version));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  const insertMigration = db.prepare('INSERT INTO schema_migrations(version) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const apply = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file);
    });

    apply();
  }
}
