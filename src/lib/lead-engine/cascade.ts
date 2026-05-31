/**
 * No-answer cascade — pure functions.
 *
 * After each unanswered call attempt the lead bumps to the back of
 * the queue for a while. The further the cascade ticks the longer
 * the lead waits before resurfacing. After the cascade is exhausted
 * (5+ attempts) the lead just keeps re-surfacing weekly — never
 * auto-dropped to lost. The user decides when to give up.
 */

const CASCADE_HOURS = [4, 24, 72, 168]; // 4h → 1d → 3d → 1w

/**
 * Given how many attempts have already been logged, return the ISO
 * timestamp when the lead should re-surface in the queue.
 *
 * `nextAttemptIndex` is 0-based and refers to the attempt that just
 * failed. So:
 *   - 0 (first no-answer)  → +4h
 *   - 1 (second)           → +1d
 *   - 2                    → +3d
 *   - 3                    → +1w
 *   - 4+                   → +1w (cap)
 */
export function nextActionAfterNoAnswer(
  nextAttemptIndex: number,
  now: Date = new Date(),
): string {
  const idx = Math.min(nextAttemptIndex, CASCADE_HOURS.length - 1);
  const hours = CASCADE_HOURS[idx];
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Human-readable label for "wann tauche ich wieder auf?".
 * Used in toasts after logging a no-answer.
 */
export function cascadeLabel(nextAttemptIndex: number): string {
  const labels = ["in 4 Stunden", "morgen", "in 3 Tagen", "in einer Woche"];
  const idx = Math.min(nextAttemptIndex, labels.length - 1);
  return labels[idx];
}
