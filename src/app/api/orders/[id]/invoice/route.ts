import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import {
  computeInvoiceTotals,
  parseDescription,
} from "@/lib/invoice/parse";
import { InvoiceDocument, type InvoiceData } from "@/lib/invoice/document";

export const dynamic = "force-dynamic";

function shortId(uuid: string) {
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [{ data: order }, { data: me }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
  ]);

  if (!order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let recipientLines: string[] = [];
  let recipientName = order.client_name ?? "Kunde";
  let recipientEmail: string | undefined;
  if (order.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("name, company, email, location")
      .eq("id", order.contact_id)
      .maybeSingle();
    if (contact) {
      recipientName = contact.company || contact.name;
      const lines: string[] = [];
      if (contact.company && contact.name) lines.push(contact.name);
      if (contact.location) lines.push(contact.location);
      recipientLines = lines;
      recipientEmail = contact.email ?? undefined;
    }
  }

  const items = parseDescription(
    order.description,
    order.title,
    order.value_cents ?? null,
  );
  const totals = computeInvoiceTotals(items);

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);

  const data: InvoiceData = {
    invoiceNumber: `KR-${today.getFullYear()}-${shortId(order.id)}`,
    invoiceDate: today.toISOString(),
    dueDate: due.toISOString(),

    sender: {
      name: "Krileo",
      addressLines: ["Krileo Agency", me?.full_name ?? ""].filter(Boolean),
      email: user.email ?? undefined,
    },
    recipient: {
      name: recipientName,
      addressLines: recipientLines,
      email: recipientEmail,
    },

    orderTitle: order.title,
    orderRef: shortId(order.id),

    items,
    totalCents: totals.totalCents,

    logoSrc: await loadLogoDataUrl(),
  };

  const buffer = await renderToBuffer(InvoiceDocument({ data }));

  const filename = `Krileo-Rechnung-${data.invoiceNumber}.pdf`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
