import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "tech-english-review.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phrases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id TEXT NOT NULL,
      story_title TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('A2','B1','B2','C1')),
      en TEXT NOT NULL,
      es TEXT NOT NULL,
      "order" INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      phrase_id INTEGER PRIMARY KEY REFERENCES phrases(id),
      next_review TEXT NOT NULL,
      interval INTEGER NOT NULL DEFAULT 1,
      ease REAL NOT NULL DEFAULT 2.5,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS completed_stories (
      story_id TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL
    );
  `);
}
