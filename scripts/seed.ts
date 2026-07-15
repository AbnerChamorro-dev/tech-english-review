import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

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

  const storiesPath = path.join(__dirname, "..", "..", "tech-english", "content", "stories.ts");
  const { STORIES } = await import(storiesPath);

  const batch: { sql: string; args: (string | number)[] }[] = [];
  let count = 0;

  for (const story of STORIES) {
    for (const line of story.lines) {
      batch.push({
        sql: 'INSERT INTO phrases (story_id, story_title, level, en, es, "order") VALUES (?, ?, ?, ?, ?, ?)',
        args: [story.id, story.title, story.level, line.en, line.es, count],
      });
      count++;
    }
  }

  // Execute in batches of 50
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    await db.batch(chunk);
    process.stdout.write(`\rInserted ${Math.min(i + 50, batch.length)}/${count}...`);
  }

  console.log(`\nDone! Imported ${count} phrases from ${STORIES.length} stories into Turso`);
}

main();
