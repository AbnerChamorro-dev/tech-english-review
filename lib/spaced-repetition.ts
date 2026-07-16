import type { Queue } from "./types";

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const EASE_UP = 0.1;
const EASE_DOWN = 0.2;

// Learning steps in minutes (Anki default: 1m → 10m → 1d)
export const LEARNING_STEPS = [1, 10]; // minutes
export const GRADUATING_INTERVAL = 1; // days
export const EASY_INTERVAL = 4; // days

export interface NextReview {
  interval: number;
  ease: number;
  queue: Queue;
  learning_step: number;
}

export function calcNextReview(
  known: boolean,
  current: { interval: number; ease: number; queue: Queue; learning_step: number }
): NextReview {
  const { queue, learning_step } = current;

  if (queue === 0) {
    // New card
    if (known) {
      if (learning_step < LEARNING_STEPS.length) {
        // Move to next learning step
        return {
          interval: LEARNING_STEPS[learning_step],
          ease: current.ease,
          queue: 1,
          learning_step: learning_step + 1,
        };
      }
      // Graduate to review
      return {
        interval: GRADUATING_INTERVAL,
        ease: current.ease,
        queue: 2,
        learning_step: 0,
      };
    }
    // Failed: back to learning step 0
    return {
      interval: LEARNING_STEPS[0] || 1,
      ease: Math.max(current.ease - EASE_DOWN, MIN_EASE),
      queue: 1,
      learning_step: 0,
    };
  }

  if (queue === 1) {
    // Learning card
    if (known) {
      if (learning_step < LEARNING_STEPS.length) {
        // Move to next learning step
        return {
          interval: LEARNING_STEPS[learning_step],
          ease: current.ease,
          queue: 1,
          learning_step: learning_step + 1,
        };
      }
      // Graduate to review
      return {
        interval: GRADUATING_INTERVAL,
        ease: current.ease,
        queue: 2,
        learning_step: 0,
      };
    }
    // Failed: back to learning step 0
    return {
      interval: LEARNING_STEPS[0] || 1,
      ease: Math.max(current.ease - EASE_DOWN, MIN_EASE),
      queue: 1,
      learning_step: 0,
    };
  }

  if (queue === 2) {
    // Review card
    if (known) {
      const newEase = Math.min(current.ease + EASE_UP, MAX_EASE);
      const newInterval = Math.max(1, Math.round(current.interval * newEase));
      return {
        interval: newInterval,
        ease: newEase,
        queue: 2,
        learning_step: 0,
      };
    }
    // Failed: lapse (back to learning)
    return {
      interval: LEARNING_STEPS[0] || 1,
      ease: Math.max(current.ease - EASE_DOWN, MIN_EASE),
      queue: 3,
      learning_step: 0,
    };
  }

  // queue === 3 (lapsed)
  if (known) {
    // Relearned: back to review
    return {
      interval: GRADUATING_INTERVAL,
      ease: current.ease,
      queue: 2,
      learning_step: 0,
    };
  }
  // Still failed: stay in learning
  return {
    interval: LEARNING_STEPS[0] || 1,
    ease: Math.max(current.ease - EASE_DOWN, MIN_EASE),
    queue: 1,
    learning_step: 0,
  };
}
