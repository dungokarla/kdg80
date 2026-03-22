import type Database from 'better-sqlite3';

export type TelegramAdminRole = 'superadmin' | 'operator';

export type TelegramAdmin = {
  id: number;
  telegramUserId: string;
  role: TelegramAdminRole;
  displayName: string | null;
};

type ClaimInput = {
  telegramUserId: string;
  displayName: string | null;
};

export function getTelegramAdminByUserId(db: Database.Database, telegramUserId: string) {
  const row = db.prepare(`
    SELECT id, telegram_user_id, role, display_name
    FROM telegram_admins
    WHERE telegram_user_id = ?
    LIMIT 1
  `).get(telegramUserId) as
    | {
        id: number;
        telegram_user_id: string;
        role: TelegramAdminRole;
        display_name: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    role: row.role,
    displayName: row.display_name,
  } satisfies TelegramAdmin;
}

export function claimFirstSuperadmin(db: Database.Database, input: ClaimInput) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM telegram_admins').get() as { count: number };
  if (count.count > 0) {
    return null;
  }

  db.prepare(`
    INSERT INTO telegram_admins(telegram_user_id, role, display_name)
    VALUES (?, 'superadmin', ?)
  `).run(input.telegramUserId, input.displayName);

  return getTelegramAdminByUserId(db, input.telegramUserId);
}

export function listTelegramAdmins(db: Database.Database) {
  const rows = db.prepare(`
    SELECT id, telegram_user_id, role, display_name
    FROM telegram_admins
    ORDER BY CASE role WHEN 'superadmin' THEN 0 ELSE 1 END, created_at ASC
  `).all() as Array<{
    id: number;
    telegram_user_id: string;
    role: TelegramAdminRole;
    display_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    telegramUserId: row.telegram_user_id,
    role: row.role,
    displayName: row.display_name,
  } satisfies TelegramAdmin));
}
