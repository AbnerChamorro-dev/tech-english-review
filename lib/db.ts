import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export async function initSchema() {
  const db = getClient();
  await db.executeMultiple(`
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
