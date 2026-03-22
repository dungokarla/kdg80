import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function createDatabase(sqlitePath: string) {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  const db = new Database(sqlitePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  return db;
}
