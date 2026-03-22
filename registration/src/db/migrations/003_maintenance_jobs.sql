CREATE TABLE IF NOT EXISTS maintenance_jobs (
  job_name TEXT PRIMARY KEY,
  last_run_key TEXT,
  last_run_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
