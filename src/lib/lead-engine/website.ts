import "server-only";

/**
 * Fetches a lead's website and extracts the signals the scorer needs to
 * pick an offer that actually fits — instead of guessing from the
 * category. The big failure we're fixing: offering a copy shop an
 * "online ordering system" it already has. You can't know that without
 * reading the actual site, so this is where we read it.
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 400_000;
const MAX_TEXT = 6000;

export type WebsiteSignals = {
  online_shop: boolean; // cart / checkout / webshop present
  online_ordering: boolean; // "online bestellen" / food ordering
  online_booking: boolean; // appointment / table booking widget
  menu_or_catalog: boolean;
  contact_form: boolean;
  ssl: boolean;
  cms: string | null; // wordpress / wix / jimdo / shopify / …
};

export type WebsiteContext = {
  hasUrl: boolean;
  reachable: boolean;
  finalUrl: string | null;
  text: string; // stripped, truncated homepage text
  signals: WebsiteSignals;
};

const EMPTY_SIGNALS: WebsiteSignals = {
  online_shop: false,
  online_ordering: false,
  online_booking: false,
  menu_or_catalog: false,
  contact_form: false,
  ssl: false,
  cms: null,
};

async function fetchRaw(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KrileoLeadEngine/1.0; +https://krileo.de)",
        Accept: "text/html,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf).slice(0, MAX_HTML_BYTES);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { html, finalUrl: resp.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  const noScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const noTags = noScripts.replace(/<[^>]+>/g, " ");
  return noTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

function detectSignals(html: string, url: string): WebsiteSignals {
  const h = html.toLowerCase();
  const has = (re: RegExp) => re.test(h);

  let cms: string | null = null;
  if (/wp-content|wp-includes|wordpress/.test(h)) cms = "wordpress";
  else if (/\.wixsite\.com|static\.wix|wix\.com/.test(h)) cms = "wix";
  else if (/jimdo/.test(h)) cms = "jimdo";
  else if (/cdn\.shopify|myshopify/.test(h)) cms = "shopify";
  else if (/squarespace/.test(h)) cms = "squarespace";
  else if (/typo3/.test(h)) cms = "typo3";
  else if (/webflow/.test(h)) cms = "webflow";
  else if (/joomla/.test(h)) cms = "joomla";

  return {
    online_shop: has(
      /warenkorb|in den korb|zur kasse|checkout|add to cart|mein konto|webshop|online[- ]?shop|cart/,
    ),
    online_ordering: has(
      /online bestellen|jetzt bestellen|bestellung aufgeben|order online|lieferando|wolt|uber ?eats|vorbestell/,
    ),
    online_booking: has(
      /termin (online )?buchen|jetzt buchen|online[- ]?termin|book(ing)? now|calendly|terminland|doctolib|jameda|tischreservierung|reservierung|reservier(en)?|appointlet/,
    ),
    menu_or_catalog: has(/speisekarte|men[uü]karte|katalog|leistungen|produkte|sortiment/),
    contact_form: has(/<form|kontaktformular|contact form/),
    ssl: url.toLowerCase().startsWith("https://"),
    cms,
  };
}

export async function fetchWebsiteContext(
  url: string | null | undefined,
): Promise<WebsiteContext> {
  if (!url || !url.trim()) {
    return {
      hasUrl: false,
      reachable: false,
      finalUrl: null,
      text: "",
      signals: { ...EMPTY_SIGNALS },
    };
  }
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  const res = await fetchRaw(normalized);
  if (!res) {
    return {
      hasUrl: true,
      reachable: false,
      finalUrl: null,
      text: "",
      signals: { ...EMPTY_SIGNALS, ssl: normalized.startsWith("https://") },
    };
  }
  return {
    hasUrl: true,
    reachable: true,
    finalUrl: res.finalUrl,
    text: stripHtml(res.html),
    signals: detectSignals(res.html, res.finalUrl),
  };
}

/** Render the context as a compact block for the scoring prompt. */
export function renderWebsiteContext(ctx: WebsiteContext): string {
  if (!ctx.hasUrl) return "Website: KEINE bekannt";
  if (!ctx.reachable)
    return "Website: vorhanden, aber NICHT erreichbar (Timeout/Fehler) — wie 'keine Website' behandeln, ABER Domain existiert.";
  const s = ctx.signals;
  const yn = (b: boolean) => (b ? "JA" : "nein");
  const lines = [
    `Website erreichbar: ${ctx.finalUrl}`,
    `Erkannte Features (Heuristik aus HTML):`,
    `  • Online-Shop/Warenkorb: ${yn(s.online_shop)}`,
    `  • Online-Bestellung: ${yn(s.online_ordering)}`,
    `  • Online-Terminbuchung: ${yn(s.online_booking)}`,
    `  • Speisekarte/Katalog/Leistungen: ${yn(s.menu_or_catalog)}`,
    `  • Kontaktformular: ${yn(s.contact_form)}`,
    `  • HTTPS: ${yn(s.ssl)}`,
    `  • CMS/Baukasten: ${s.cms ?? "unbekannt/custom"}`,
    ``,
    `WEBSITE-TEXT (gekürzt, das ist was wirklich auf der Seite steht):`,
    `"""`,
    ctx.text || "(kein Text extrahierbar)",
    `"""`,
  ];
  return lines.join("\n");
}
