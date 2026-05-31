/**
 * Supabase / PostgREST errors are plain objects with shape
 *   { message, details, hint, code }
 * not `Error` instances. The default `String(err)` therefore produces
 * "[object Object]" which is useless. This helper produces a readable
 * one-liner suitable for both UI and console.
 */
export function formatLeadEngineError(err: unknown): string {
  if (err == null) return "Unbekannter Fehler";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts: string[] = [];
    if (e.message) parts.push(e.message);
    if (e.details) parts.push(e.details);
    if (e.hint) parts.push(`Hint: ${e.hint}`);
    if (e.code) parts.push(`[${e.code}]`);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(err);
    } catch {
      return "Fehler beim Lead-Engine-Zugriff";
    }
  }
  return String(err);
}
