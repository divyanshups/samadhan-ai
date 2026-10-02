"""Small SQLite helpers. Every write uses a transaction."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def database_path():
    return Path(os.getenv("SAMADHAN_DB", str(ROOT / "data/samadhan-v2.sqlite3")))


@contextmanager
def connect():
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT 'citizen', district TEXT NOT NULL DEFAULT '',
          locality TEXT NOT NULL DEFAULT '', department_id TEXT, active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS otp_requests (
          phone TEXT PRIMARY KEY, code_hash TEXT, expires_at TEXT, requested_at TEXT,
          attempts INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS drafts (
          id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), data TEXT NOT NULL DEFAULT '{}',
          messages TEXT NOT NULL DEFAULT '[]', stage TEXT NOT NULL DEFAULT 'issue_description',
          ready INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0,
          voice_hash TEXT, voice_expires_at TEXT, call_id TEXT, submitted_id TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS complaints (
          id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), draft_id TEXT UNIQUE REFERENCES drafts(id),
          citizen_name TEXT, phone TEXT, district TEXT, locality TEXT, data TEXT NOT NULL,
          category_id TEXT NOT NULL, department_id TEXT, status TEXT NOT NULL,
          employee_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          completed_at TEXT, review_due_at TEXT, resolved_at TEXT, reopened_count INTEGER DEFAULT 0,
          estimate TEXT NOT NULL, due_at TEXT NOT NULL, overdue_notified INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS complaint_events (
          id INTEGER PRIMARY KEY, complaint_id TEXT REFERENCES complaints(id), actor_id TEXT,
          status TEXT, note TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS updates (
          id INTEGER PRIMARY KEY, user_id TEXT REFERENCES users(id), kind TEXT, text_en TEXT, text_hi TEXT,
          complaint_id TEXT, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notices (
          id TEXT PRIMARY KEY, author_id TEXT REFERENCES users(id), district TEXT,
          title_en TEXT, title_hi TEXT, body_en TEXT, body_hi TEXT, created_at TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS uploads (
          id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), filename TEXT, mime TEXT
        );
        CREATE TABLE IF NOT EXISTS tool_results (
          call_id TEXT, tool_id TEXT, result TEXT, PRIMARY KEY(call_id,tool_id)
        );
        CREATE INDEX IF NOT EXISTS complaint_scope ON complaints(district,department_id,status);
        CREATE INDEX IF NOT EXISTS update_recipient ON updates(user_id,created_at);
        """)
        # Keep existing installations and their complaint data when upgrading.
        columns = {row["name"] for row in db.execute("PRAGMA table_info(drafts)")}
        if "category_requested" not in columns:
            db.execute(
                "ALTER TABLE drafts ADD COLUMN category_requested INTEGER NOT NULL DEFAULT 0"
            )
        user_columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
        for column in ["username", "password_hash"]:
            if column not in user_columns:
                db.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT")
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS unique_username ON users(lower(username)) WHERE username IS NOT NULL")
        if "password_hash" not in user_columns:
            # Sessions issued through the former staff OTP flow must sign in again.
            db.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role IN ('admin','officer'))")
