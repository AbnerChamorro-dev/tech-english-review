const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const EASE_UP = 0.1;
const EASE_DOWN = 0.2;

export function calcNextReview(known: boolean, current: { interval: number; ease: number }) {
  if (known) {
    const newEase = Math.min(current.ease + EASE_UP, MAX_EASE);
    const newInterval = Math.max(1, Math.round(current.interval * newEase));
    return { interval: newInterval, ease: newEase };
  }
  return { interval: 1, ease: Math.max(current.ease - EASE_DOWN, MIN_EASE) };
}
