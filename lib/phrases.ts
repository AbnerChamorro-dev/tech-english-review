import type { Client } from "@libsql/client";
import type { PhraseWithReview, Level } from "./types";
import { calcNextReview } from "./spaced-repetition";

export async function getCompletedStoryIds(db: Client): Promise<string[]> {
  const result = await db.execute("SELECT story_id FROM completed_stories");
  return result.rows.map((r) => r.story_id as string);
}

export async function markStoryComplete(db: Client, storyId: string) {
  await db.execute({
    sql: "INSERT OR REPLACE INTO completed_stories (story_id, completed_at) VALUES (?, ?)",
    args: [storyId, new Date().toISOString()],
  });
}

export async function markStoryIncomplete(db: Client, storyId: string) {
  await db.execute({ sql: "DELETE FROM completed_stories WHERE story_id = ?", args: [storyId] });
}

export async function getDuePhrases(db: Client, limit = 50): Promise<PhraseWithReview[]> {
  const today = new Date().toISOString().split("T")[0];
  const result = await db.execute({
    sql: `SELECT p.*, r.next_review, r.interval, r.ease, r.reviews_count, r.last_seen
          FROM phrases p
          INNER JOIN completed_stories cs ON cs.story_id = p.story_id
          LEFT JOIN reviews r ON r.phrase_id = p.id
          WHERE r.next_review IS NULL OR r.next_review <= ?
          ORDER BY r.next_review ASC NULLS FIRST, p."order" ASC
          LIMIT ?`,
    args: [today, limit],
  });
  return result.rows as unknown as PhraseWithReview[];
}

export async function getReviewStats(db: Client) {
  const today = new Date().toISOString().split("T")[0];
  const [total, due, learned] = await Promise.all([
    db.execute("SELECT COUNT(*) as n FROM phrases p INNER JOIN completed_stories cs ON cs.story_id = p.story_id"),
    db.execute({ sql: "SELECT COUNT(*) as n FROM phrases p INNER JOIN completed_stories cs ON cs.story_id = p.story_id LEFT JOIN reviews r ON r.phrase_id = p.id WHERE r.next_review IS NULL OR r.next_review <= ?", args: [today] }),
    db.execute("SELECT COUNT(*) as n FROM reviews WHERE interval >= 7"),
  ]);
  return {
    total: Number(total.rows[0].n),
    due: Number(due.rows[0].n),
    learned: Number(learned.rows[0].n),
  };
}

export async function reviewPhrase(db: Client, phraseId: number, known: boolean) {
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.execute({ sql: "SELECT * FROM reviews WHERE phrase_id = ?", args: [phraseId] });
  const row = existing.rows[0];

  const current = row
    ? { interval: Number(row.interval), ease: Number(row.ease) }
    : { interval: 1, ease: 2.5 };

  const next = calcNextReview(known, current);

  if (row) {
    await db.execute({
      sql: `UPDATE reviews
            SET next_review = date('now', '+' || ? || ' days'),
                interval = ?, ease = ?, reviews_count = reviews_count + 1, last_seen = ?
            WHERE phrase_id = ?`,
      args: [next.interval, next.interval, next.ease, today, phraseId],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO reviews (phrase_id, next_review, interval, ease, reviews_count, last_seen)
            VALUES (?, date('now', '+' || ? || ' days'), ?, ?, 1, ?)`,
      args: [phraseId, next.interval, next.interval, next.ease, today],
    });
  }
}

export async function getStoriesWithStatus(db: Client) {
  const result = await db.execute(`
    SELECT p.story_id, p.story_title, p.level, COUNT(*) as phrase_count,
           cs.completed_at
    FROM phrases p
    LEFT JOIN completed_stories cs ON cs.story_id = p.story_id
    GROUP BY p.story_id
    ORDER BY MIN(p."order")
  `);

  return result.rows.map((s) => ({
    id: s.story_id as string,
    title: s.story_title as string,
    level: s.level as Level,
    phraseCount: Number(s.phrase_count),
    completed: s.completed_at !== null,
  }));
}
