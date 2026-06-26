import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import {
  OfferDocument,
  type OfferData,
  type OfferPriceItem,
} from "@/lib/akquise/offer-document";

export const dynamic = "force-dynamic";

async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), "public", "krileo-icon.png"),
    );
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\- ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

type Body = {
  customerName?: string;
  customerLines?: string[];
  deliverable?: string;
  setup_eur?: number | null;
  monthly_eur?: number | null;
  /** Detailed line items (Posten + Preis). When present, they drive the
   *  price table + a summed total, instead of the setup/monthly model. */
  items?: Array<{ label?: string; eur?: number | null }>;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const customerName = body.customerName?.trim() || "Kunde";
  const deliverable = body.deliverable?.trim();
  const setup = typeof body.setup_eur === "number" ? body.setup_eur : null;
  const monthly =
    typeof body.monthly_eur === "number" && body.monthly_eur > 0
      ? body.monthly_eur
      : null;

  // Detailed line items (Posten + Preis), if the user itemised the offer.
  const lineItems = (body.items ?? [])
    .map((it) => ({
      label: (it.label ?? "").trim(),
      eur: typeof it.eur === "number" ? it.eur : 0,
    }))
    .filter((it) => it.label && it.eur > 0);

  if (!deliverable) {
    return NextResponse.json(
      { error: "Auftragsumfang fehlt" },
      { status: 400 },
    );
  }
  if (lineItems.length === 0 && (setup == null || setup <= 0)) {
    return NextResponse.json({ error: "Preis fehlt" }, { status: 400 });
  }

  let priceItems: OfferPriceItem[];
  let total: OfferData["total"];
  let termLine: string;
  if (lineItems.length > 0) {
    // Detailed mode — itemised posten + summed total.
    priceItems = lineItems.map((it) => ({
      label: it.label,
      eur: it.eur,
    }));
    if (monthly) {
      priceItems.push({
        label: "Monatlich (laufend)",
        eur: monthly,
        suffix: "/ Monat zzgl. USt.",
      });
    }
    const oneTimeSum = lineItems.reduce((s, it) => s + it.eur, 0);
    total = { label: "Gesamt", eur: oneTimeSum, suffix: "zzgl. USt." };
    termLine = monthly
      ? "Bereitstellung nach Auftragsbestätigung. Laufende Position monatlich, 12 Monate Laufzeit, danach monatlich kündbar."
      : "Bereitstellung nach Auftragsbestätigung.";
  } else if (monthly) {
    // Simple mode — setup + monthly subscription.
    priceItems = [
      { label: "Einmalige Einrichtung", eur: setup as number, suffix: "zzgl. USt." },
      { label: "Monatlich", eur: monthly, suffix: "zzgl. USt." },
    ];
    termLine =
      "Bereitstellung nach Auftragsbestätigung. Laufzeit 12 Monate, danach monatlich kündbar.";
  } else {
    // Simple mode — one-time project.
    priceItems = [
      { label: "Einmalige Investition", eur: setup as number, suffix: "zzgl. USt." },
    ];
    termLine =
      "Bereitstellung nach Auftragsbestätigung. Einmaliges Projekt — keine laufenden Kosten.";
  }

  const data: OfferData = {
    documentTitle: "Auftrag",
    documentSubtitle: "Leistungs- & Preisübersicht",
    dateLabel: new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    customerName,
    customerLines: (body.customerLines ?? []).filter(Boolean),
    deliverable,
    priceItems,
    total,
    termLine,
    logoSrc: await loadLogoDataUrl(),
  };

  const buffer = await renderToBuffer(OfferDocument({ data }));
  const filename = `Krileo-Auftrag-${safeFilename(customerName)}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
