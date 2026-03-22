import type Database from 'better-sqlite3';

export type TelegramAdminRole = 'superadmin' | 'operator';

export type TelegramAdmin = {
  id: number;
  telegramUserId: string;
  role: TelegramAdminRole;
  displayName: string | null;
};

export type TelegramOperatorRequest = {
  id: number;
  telegramUserId: string;
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

export function createOrRefreshOperatorRequest(db: Database.Database, input: ClaimInput) {
  db.prepare(`
    INSERT INTO telegram_operator_requests(telegram_user_id, display_name)
    VALUES (?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      display_name = excluded.display_name,
      updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(input.telegramUserId, input.displayName);
}

export function listTelegramOperatorRequests(db: Database.Database) {
  const rows = db.prepare(`
    SELECT id, telegram_user_id, display_name
    FROM telegram_operator_requests
    ORDER BY requested_at ASC, id ASC
  `).all() as Array<{
    id: number;
    telegram_user_id: string;
    display_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    telegramUserId: row.telegram_user_id,
    displayName: row.display_name,
  } satisfies TelegramOperatorRequest));
}

export function grantOperatorFromRequest(db: Database.Database, requestId: number) {
  const request = db.prepare(`
    SELECT id, telegram_user_id, display_name
    FROM telegram_operator_requests
    WHERE id = ?
    LIMIT 1
  `).get(requestId) as
    | {
        id: number;
        telegram_user_id: string;
        display_name: string | null;
      }
    | undefined;

  if (!request) {
    return null;
  }

  const apply = db.transaction(() => {
    db.prepare(`
      INSERT INTO telegram_admins(telegram_user_id, role, display_name)
      VALUES (?, 'operator', ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        role = 'operator',
        display_name = excluded.display_name
    `).run(request.telegram_user_id, request.display_name);

    db.prepare('DELETE FROM telegram_operator_requests WHERE id = ?').run(requestId);
  });

  apply();
  return getTelegramAdminByUserId(db, request.telegram_user_id);
}

export function revokeOperator(db: Database.Database, adminId: number) {
  const row = db.prepare(`
    SELECT id, telegram_user_id, role, display_name
    FROM telegram_admins
    WHERE id = ?
    LIMIT 1
  `).get(adminId) as
    | {
        id: number;
        telegram_user_id: string;
        role: TelegramAdminRole;
        display_name: string | null;
      }
    | undefined;

  if (!row || row.role !== 'operator') {
    return null;
  }

  db.prepare('DELETE FROM telegram_admins WHERE id = ?').run(adminId);

  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    role: row.role,
    displayName: row.display_name,
  } satisfies TelegramAdmin;
}
