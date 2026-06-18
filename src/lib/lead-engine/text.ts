/**
 * Remove EVERY em/en-dash from generated copy. The user never wants these
 * "AI-slop" dashes (— –) in any text a customer could see, so this is a hard
 * strip, not a cap: a spaced dash (parenthetical) becomes a comma, a dash
 * between digits (a range) becomes a plain hyphen, anything else collapses to
 * a space. Regular hyphens in compound words ("mobil-optimiert") use "-" and
 * are untouched; newlines (paragraph breaks) are preserved.
 *
 * Applied both when scoring writes copy to the DB and again at the Smartlead
 * push boundary, so even legacy/already-scored leads can't carry a dash into
 * a real mail.
 */
export function stripDashes(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2") // ranges: "2 – 5" → "2-5"
    .replace(/[^\S\n]*[—–][^\S\n]*/g, ", ") // parenthetical dash → comma
    .replace(/([.!?])\s*,\s*/g, "$1 ") // ". ," → ". "
    .replace(/,\s*,/g, ", ") // collapse double commas
    .replace(/ +,/g, ",") // no space before comma
    .replace(/,(?=\S)/g, ", ") // ensure a space after comma
    .replace(/[^\S\n]{2,}/g, " ") // collapse runs of spaces
    .trim();
}
