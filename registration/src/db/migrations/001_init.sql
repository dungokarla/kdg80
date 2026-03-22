CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS halls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  venue_name TEXT NOT NULL,
  hall_name TEXT NOT NULL,
  address TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  hall_name TEXT NOT NULL,
  address TEXT NOT NULL,
  hall_id INTEGER REFERENCES halls(id) ON DELETE SET NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  seats_taken INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  registration_public_state TEXT NOT NULL DEFAULT 'soon' CHECK (registration_public_state IN ('open', 'soon', 'closed')),
  registration_opens_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source_status TEXT NOT NULL DEFAULT 'ready',
  source_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pii_ciphertext BLOB NOT NULL,
  pii_wrapped_key BLOB NOT NULL,
  pii_iv BLOB NOT NULL,
  pii_alg TEXT NOT NULL,
  full_name_fingerprint TEXT NOT NULL,
  email_fingerprint TEXT NOT NULL,
  phone_fingerprint TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  consent_accepted_at TEXT NOT NULL,
  source_ip TEXT,
  user_agent TEXT,
  test_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS registrations_event_email_fingerprint_idx
  ON registrations(event_id, email_fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS registrations_event_phone_fingerprint_idx
  ON registrations(event_id, phone_fingerprint);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  public_hash TEXT NOT NULL UNIQUE,
  short_ticket_id TEXT NOT NULL UNIQUE,
  public_url TEXT,
  pdf_url TEXT,
  ics_url TEXT,
  seating_mode TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS telegram_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  not_before TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS telegram_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'operator')),
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
