import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { loadIssuer } from "@/lib/invoice/issuer";
import {
  invoiceTotalCents,
  issuerAddress,
  type InvoiceState,
} from "@/lib/invoice/types";
import { InvoiceDocument, type InvoiceData } from "@/lib/invoice/document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shortId(uuid: string) {
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

const hasAny = (...vals: (string | undefined)[]) =>
  vals.some((v) => v && v.trim());

const cleanLines = (...vals: (string | undefined)[]) =>
  vals.map((v) => (v ?? "").trim()).filter(Boolean);

async function loadPng(name: string): Promise<string | undefined> {
  try {
    const file = await fs.readFile(path.join(process.cwd(), "public", name));
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Render a PDF from the invoice state posted by the editor (live preview +
 *  download). Pure render — no DB writes. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { state?: InvoiceState };
  try {
    body = (await req.json()) as { state?: InvoiceState };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const state = body.state;
  if (!state) {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("title, id")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const base = await loadIssuer();
  // Per-invoice issuer identity (editor) layered over the Settings defaults.
  const name = state.issuerName?.trim() || base.senderName;
  const degree = (state.issuerDegree ?? base.degree ?? "").trim();
  // Master/Bachelor grades follow the name (DIN 5008), no comma.
  const issuer = {
    ...base,
    senderName: degree ? `${name} ${degree}` : name,
  };
  const issuerAddressLines = hasAny(
    state.issuerStreet,
    state.issuerCity,
    state.issuerCountry,
  )
    ? cleanLines(state.issuerStreet, state.issuerCity, state.issuerCountry)
    : issuerAddress(base);

  // Recipient address: structured fields if present, else legacy lines.
  const recipient = {
    ...state.recipient,
    addressLines: hasAny(
      state.recipient.street,
      state.recipient.city,
      state.recipient.country,
    )
      ? cleanLines(
          state.recipient.street,
          state.recipient.city,
          state.recipient.country,
        )
      : state.recipient.addressLines,
  };

  const items = state.items.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitCents: li.unitCents,
    totalCents: Math.round(li.quantity * li.unitCents),
    kind: li.kind,
  }));
  const subtotal = invoiceTotalCents(state.items);

  const data: InvoiceData = {
    invoiceNumber: state.number,
    invoiceDate: state.date,
    dueDate: state.dueDate,
    currency: state.currency,
    taglineRight: state.taglineRight,
    issuerContact: state.issuerContact ?? "",
    showVat: state.showVat ?? false,
    vatRate: state.vatRate ?? 19,
    issuer,
    issuerAddressLines,
    recipient,
    orderTitle: order.title,
    orderRef: shortId(order.id),
    items,
    subtotalCents: subtotal,
    totalCents: subtotal,
    billingMode: state.billingMode,
    notes: state.notes,
    logoSrc: await loadPng("krileo-icon.png"),
  };

  const buffer = await renderToBuffer(InvoiceDocument({ data }));
  const filename = `Krileo-Rechnung-${state.number}.pdf`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
