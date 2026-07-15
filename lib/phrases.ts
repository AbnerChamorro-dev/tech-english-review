import type { Database } from "better-sqlite3";
import type { Phrase, PhraseWithReview, Level } from "./types";
import { calcNextReview } from "./spaced-repetition";

interface CountRow {
  n: number;
}

interface StoryRow {
  story_id: string;
  story_title: string;
  level: string;
  phrase_count: number;
  completed_at: string | null;
}

interface ReviewRow {
  phrase_id: number;
  interval: number;
  ease: number;
  next_review: string;
}

export function getCompletedStoryIds(db: Database): string[] {
  return db.prepare("SELECT story_id FROM completed_stories").all().map((r) => (r as { story_id: string }).story_id);
}

export function getPhrasesByStory(db: Database, storyId: string): Phrase[] {
  return db.prepare('SELECT * FROM phrases WHERE story_id = ? ORDER BY "order"').all(storyId) as Phrase[];
}

export function markStoryComplete(db: Database, storyId: string) {
  db.prepare("INSERT OR REPLACE INTO completed_stories (story_id, completed_at) VALUES (?, ?)").run(storyId, new Date().toISOString());
}

export function markStoryIncomplete(db: Database, storyId: string) {
  db.prepare("DELETE FROM completed_stories WHERE story_id = ?").run(storyId);
}

export function getDuePhrases(db: Database, limit = 50): PhraseWithReview[] {
  const today = new Date().toISOString().split("T")[0];
  return db.prepare(`
    SELECT p.*, r.next_review, r.interval, r.ease, r.reviews_count, r.last_seen
    FROM phrases p
    INNER JOIN completed_stories cs ON cs.story_id = p.story_id
    LEFT JOIN reviews r ON r.phrase_id = p.id
    WHERE r.next_review IS NULL OR r.next_review <= ?
    ORDER BY r.next_review ASC NULLS FIRST, p."order" ASC
    LIMIT ?
  `).all(today, limit) as PhraseWithReview[];
}

export function getReviewStats(db: Database) {
  const today = new Date().toISOString().split("T")[0];
  const total = db.prepare("SELECT COUNT(*) as n FROM phrases p INNER JOIN completed_stories cs ON cs.story_id = p.story_id").get() as CountRow;
  const due = db.prepare("SELECT COUNT(*) as n FROM phrases p INNER JOIN completed_stories cs ON cs.story_id = p.story_id LEFT JOIN reviews r ON r.phrase_id = p.id WHERE r.next_review IS NULL OR r.next_review <= ?").get(today) as CountRow;
  const learned = db.prepare("SELECT COUNT(*) as n FROM reviews WHERE interval >= 7").get() as CountRow;

  return { total: total.n, due: due.n, learned: learned.n };
}

export function reviewPhrase(db: Database, phraseId: number, known: boolean) {
  const today = new Date().toISOString().split("T")[0];
  const existing = db.prepare("SELECT * FROM reviews WHERE phrase_id = ?").get(phraseId) as ReviewRow | undefined;

  const current = existing
    ? { interval: existing.interval, ease: existing.ease }
    : { interval: 1, ease: 2.5 };

  const next = calcNextReview(known, current);

  if (existing) {
    db.prepare(`
      UPDATE reviews
      SET next_review = date('now', '+' || ? || ' days'),
          interval = ?, ease = ?, reviews_count = reviews_count + 1, last_seen = ?
      WHERE phrase_id = ?
    `).run(next.interval, next.interval, next.ease, today, phraseId);
  } else {
    db.prepare(`
      INSERT INTO reviews (phrase_id, next_review, interval, ease, reviews_count, last_seen)
      VALUES (?, date('now', '+' || ? || ' days'), ?, ?, 1, ?)
    `).run(phraseId, next.interval, next.interval, next.ease, today);
  }
}

export function getStoriesWithStatus(db: Database) {
  const stories = db.prepare(`
    SELECT p.story_id, p.story_title, p.level, COUNT(*) as phrase_count,
           cs.completed_at
    FROM phrases p
    LEFT JOIN completed_stories cs ON cs.story_id = p.story_id
    GROUP BY p.story_id
    ORDER BY MIN(p."order")
  `).all() as StoryRow[];

  return stories.map((s) => ({
    id: s.story_id,
    title: s.story_title,
    level: s.level as Level,
    phraseCount: s.phrase_count,
    completed: s.completed_at !== null,
  }));
}
