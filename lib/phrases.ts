import type { Client } from "@libsql/client";
import type { PhraseWithReview, Level, Queue } from "./types";
import { calcNextReview } from "./spaced-repetition";

const DAILY_NEW_LIMIT = 20;

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
  const now = new Date().toISOString();

  // Get count of new cards seen today
  const newCountResult = await db.execute({
    sql: `SELECT COUNT(*) as n FROM reviews r
          INNER JOIN phrases p ON p.id = r.phrase_id
          INNER JOIN completed_stories cs ON cs.story_id = p.story_id
          WHERE r.queue >= 2 AND r.last_seen = ?`,
    args: [today],
  });
  const newCount = Number(newCountResult.rows[0].n);
  const newLimit = Math.max(0, DAILY_NEW_LIMIT - newCount);

  // Priority: learning (queue 1) > lapsed (queue 3) > new (queue 0) > review (queue 2)
  const result = await db.execute({
    sql: `SELECT p.*, r.next_review, r.interval, r.ease, r.reviews_count, r.last_seen,
                 COALESCE(r.queue, 0) as queue, COALESCE(r.learning_step, 0) as learning_step
          FROM phrases p
          INNER JOIN completed_stories cs ON cs.story_id = p.story_id
          LEFT JOIN reviews r ON r.phrase_id = p.id
          WHERE (
            -- Learning cards due now (queue 1)
            (COALESCE(r.queue, 0) = 1 AND r.next_review <= ?)
            OR
            -- Lapsed cards due now (queue 3)
            (COALESCE(r.queue, 0) = 3 AND r.next_review <= ?)
            OR
            -- New cards (queue 0) - no review yet, within daily limit
            (r.phrase_id IS NULL AND ? > 0)
            OR
            -- Review cards due today (queue 2)
            (COALESCE(r.queue, 0) = 2 AND r.next_review <= ?)
          )
          ORDER BY
            CASE
              WHEN COALESCE(r.queue, 0) = 1 THEN 0  -- Learning first
              WHEN COALESCE(r.queue, 0) = 3 THEN 1  -- Lapsed second
              WHEN r.phrase_id IS NULL THEN 2        -- New third
              WHEN COALESCE(r.queue, 0) = 0 THEN 2  -- New (with review) third
              ELSE 3                                  -- Review last
            END,
            r.next_review ASC NULLS FIRST,
            p."order" ASC
          LIMIT ?`,
    args: [now, now, newLimit, today, limit],
  });
  return result.rows as unknown as PhraseWithReview[];
}

export async function getReviewStats(db: Client) {
  const today = new Date().toISOString().split("T")[0];
  const [total, learning, newCount, review, lapsed] = await Promise.all([
    db.execute("SELECT COUNT(DISTINCT p.story_id || '#' || p.\"order\") as n FROM phrases p INNER JOIN completed_stories cs ON cs.story_id = p.story_id"),
    db.execute("SELECT COUNT(*) as n FROM reviews WHERE queue = 1"),
    db.execute("SELECT COUNT(*) as n FROM reviews WHERE queue IN (0, 1) OR phrase_id IS NULL"),
    db.execute({ sql: "SELECT COUNT(*) as n FROM reviews WHERE queue = 2 AND next_review <= ?", args: [today] }),
    db.execute("SELECT COUNT(*) as n FROM reviews WHERE queue = 3"),
  ]);
  return {
    total: Number(total.rows[0].n),
    learning: Number(learning.rows[0].n),
    new: Number(newCount.rows[0].n),
    review: Number(review.rows[0].n),
    lapsed: Number(lapsed.rows[0].n),
  };
}

export async function reviewPhrase(
  db: Client,
  phraseId: number,
  known: boolean
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];

  const existing = await db.execute({
    sql: "SELECT interval, ease, queue, learning_step FROM reviews WHERE phrase_id = ?",
    args: [phraseId],
  });
  const row = existing.rows[0];

  if (!row) {
    const phrase = await db.execute({ sql: "SELECT id FROM phrases WHERE id = ?", args: [phraseId] });
    if (phrase.rows.length === 0) return false;
  }

  const current = row
    ? {
        interval: Number(row.interval),
        ease: Number(row.ease),
        queue: Number(row.queue) as Queue,
        learning_step: Number(row.learning_step),
      }
    : { interval: 1, ease: 2.5, queue: 0 as Queue, learning_step: 0 };

  const next = calcNextReview(known, current);

  // Calculate next_review time based on interval
  let nextReviewSQL: string;
  if (next.queue === 1 || next.queue === 3) {
    // Learning/lapsed: use minutes
    nextReviewSQL = `date('now', '+' || ? || ' minutes')`;
  } else {
    // New/review: use days
    nextReviewSQL = `date('now', '+' || ? || ' days')`;
  }

  await db.execute({
    sql: `INSERT INTO reviews (phrase_id, next_review, interval, ease, reviews_count, last_seen, queue, learning_step)
          VALUES (?, ${nextReviewSQL}, ?, ?, 1, ?, ?, ?)
          ON CONFLICT(phrase_id) DO UPDATE SET
            next_review = ${nextReviewSQL},
            interval = ?,
            ease = ?,
            reviews_count = reviews_count + 1,
            last_seen = ?,
            queue = ?,
            learning_step = ?`,
    args: [
      phraseId, next.interval, next.interval, next.ease, today, next.queue, next.learning_step,
      next.interval, next.interval, next.ease, today, next.queue, next.learning_step,
    ],
  });
  return true;
}

export async function getStoriesWithStatus(db: Client) {
  const [meta, phraseRows] = await Promise.all([
    db.execute(`
      SELECT p.story_id, p.story_title, p.level, COUNT(DISTINCT p."order") as phrase_count,
             cs.completed_at
      FROM phrases p
      LEFT JOIN completed_stories cs ON cs.story_id = p.story_id
      GROUP BY p.story_id
      ORDER BY MIN(p."order")
    `),
    // The English text of each phrase (deduped per story/order, matching how
    // getDuePhrases picks rows) so the client can pre-cache the audio.
    db.execute(`
      SELECT story_id, en FROM phrases
      WHERE id IN (SELECT MIN(id) FROM phrases GROUP BY story_id, "order")
      ORDER BY story_id, "order"
    `),
  ]);

  const phrasesByStory = new Map<string, string[]>();
  for (const r of phraseRows.rows) {
    const sid = r.story_id as string;
    const list = phrasesByStory.get(sid) ?? [];
    list.push(r.en as string);
    phrasesByStory.set(sid, list);
  }

  return meta.rows.map((s) => ({
    id: s.story_id as string,
    title: s.story_title as string,
    level: s.level as Level,
    phraseCount: Number(s.phrase_count),
    completed: s.completed_at !== null,
    phrases: phrasesByStory.get(s.story_id as string) ?? [],
  }));
}
