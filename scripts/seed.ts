import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

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

  // Fix data from earlier non-idempotent seed runs: drop duplicate phrases
  // (same story_id + order), keeping the lowest id, then enforce uniqueness so
  // re-seeding upserts instead of duplicating.
  await db.executeMultiple(`
    DELETE FROM phrases
    WHERE id NOT IN (SELECT MIN(id) FROM phrases GROUP BY story_id, "order");
    DELETE FROM reviews WHERE phrase_id NOT IN (SELECT id FROM phrases);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_phrases_story_order ON phrases(story_id, "order");
  `);

  const storiesPath = path.join(__dirname, "..", "..", "tech-english", "content", "stories.ts");
  if (!fs.existsSync(storiesPath)) {
    console.error(
      `No se encontró el corpus de frases en:\n  ${storiesPath}\n\n` +
        "El seed depende del repo hermano 'tech-english' colocado junto a este proyecto.\n" +
        "Clónalo al lado de tech-english-review y vuelve a ejecutar `npm run seed`."
    );
    process.exit(1);
  }
  const { STORIES } = await import(storiesPath);

  const batch: { sql: string; args: (string | number)[] }[] = [];
  let count = 0;

  for (const story of STORIES) {
    for (const line of story.lines) {
      batch.push({
        sql: `INSERT INTO phrases (story_id, story_title, level, en, es, "order")
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(story_id, "order") DO UPDATE SET
                story_title = excluded.story_title,
                level = excluded.level,
                en = excluded.en,
                es = excluded.es`,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
