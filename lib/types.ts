export type Level = "A2" | "B1" | "B2" | "C1";

export interface Phrase {
  id: number;
  story_id: string;
  story_title: string;
  level: Level;
  en: string;
  es: string;
  order: number;
}

export interface Review {
  phrase_id: number;
  next_review: string;
  interval: number;
  ease: number;
  reviews_count: number;
  last_seen: string | null;
}

export interface PhraseWithReview extends Phrase {
  next_review: string;
  interval: number;
  ease: number;
  reviews_count: number;
  last_seen: string | null;
}

export interface CompletedStory {
  story_id: string;
  completed_at: string;
}

export const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];

export const LEVEL_LABEL: Record<Level, string> = {
  A2: "A2 · Básico",
  B1: "B1 · Intermedio",
  B2: "B2 · Intermedio alto",
  C1: "C1 · Avanzado",
};
