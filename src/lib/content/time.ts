// Local-time helpers for a client's timezone (default Europe/Berlin).
// Built on formatToParts so Safari and Node agree (no "en-CA" tricks).

export const DEFAULT_TZ = "Europe/Berlin";

type Parts = { y: number; m: number; d: number; h: number; min: number };

function partsIn(date: Date, tz: string): Parts {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of today in tz. */
export function todayIn(tz = DEFAULT_TZ): string {
  const p = partsIn(new Date(), tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Local date + "HH:mm" in tz → ISO timestamp (UTC). */
export function localToIso(ymd: string, hm: string, tz = DEFAULT_TZ): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, min] = (hm || "12:00").split(":").map(Number);
  // Guess UTC, then correct by the zone's offset at that moment (twice for DST edges).
  let t = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(t), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    t += Date.UTC(y, m - 1, d, h, min) - asUtc;
  }
  return new Date(t).toISOString();
}

/** ISO → { date: "YYYY-MM-DD", time: "HH:mm" } in tz. */
export function isoToLocal(iso: string, tz = DEFAULT_TZ): { date: string; time: string } {
  const p = partsIn(new Date(iso), tz);
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}` };
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];

/** "Mittwoch, 3. Dez." */
export function dayLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${d}. ${MONTHS[m - 1]}`;
}

/** "Mi 3.12." */
export function dayShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[wd]} ${d}.${m}.`;
}

/** Whole days from today (tz) to ymd; negative = overdue. */
export function daysUntil(ymd: string, tz = DEFAULT_TZ): number {
  const [y1, m1, d1] = todayIn(tz).split("-").map(Number);
  const [y2, m2, d2] = ymd.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "heute", "morgen", "in 3 Tagen", "seit 2 Tagen überfällig" */
export function relativeDay(ymd: string, tz = DEFAULT_TZ): string {
  const n = daysUntil(ymd, tz);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n > 1) return `in ${n} Tagen`;
  if (n === -1) return "seit gestern überfällig";
  return `seit ${-n} Tagen überfällig`;
}

/** Monday of the week that contains ymd. */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

/** ISO calendar week number. */
export function isoWeek(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}
