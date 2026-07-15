import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "tech-english-review.db");

async function main() {
  const storiesPath = path.join(__dirname, "..", "..", "tech-english", "content", "stories.ts");
  const { STORIES } = await import(storiesPath);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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

  const insert = db.prepare(
    'INSERT INTO phrases (story_id, story_title, level, en, es, "order") VALUES (?, ?, ?, ?, ?, ?)'
  );

  let count = 0;
  for (const story of STORIES) {
    for (const line of story.lines) {
      insert.run(story.id, story.title, story.level, line.en, line.es, count);
      count++;
    }
  }

  console.log(`Imported ${count} phrases from ${STORIES.length} stories`);
  db.close();
}

main();
