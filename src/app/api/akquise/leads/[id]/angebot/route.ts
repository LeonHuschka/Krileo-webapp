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

  if (!deliverable) {
    return NextResponse.json(
      { error: "Auftragsumfang fehlt" },
      { status: 400 },
    );
  }
  if (setup == null || setup <= 0) {
    return NextResponse.json({ error: "Preis fehlt" }, { status: 400 });
  }

  // Price model: setup + monthly (subscription) vs. one-time project.
  let priceItems: OfferPriceItem[];
  let termLine: string;
  if (monthly) {
    priceItems = [
      { label: "Einmalige Einrichtung", eur: setup, suffix: "zzgl. USt." },
      { label: "Monatlich", eur: monthly, suffix: "zzgl. USt." },
    ];
    termLine =
      "Bereitstellung nach Auftragsbestätigung. Laufzeit 12 Monate, danach monatlich kündbar.";
  } else {
    priceItems = [
      { label: "Einmalige Investition", eur: setup, suffix: "zzgl. USt." },
    ];
    termLine =
      "Bereitstellung nach Auftragsbestätigung. Einmaliges Projekt — keine laufenden Kosten.";
  }

  const data: OfferData = {
    documentTitle: "Auftrag",
    dateLabel: new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    customerName,
    customerLines: (body.customerLines ?? []).filter(Boolean),
    deliverable,
    priceItems,
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
