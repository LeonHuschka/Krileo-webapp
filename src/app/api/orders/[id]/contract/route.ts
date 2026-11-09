import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { loadIssuer } from "@/lib/invoice/issuer";
import { issuerAddress } from "@/lib/invoice/types";
import { ContractDocument } from "@/lib/contract/document";
import type { ContractState } from "@/lib/contract/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const clean = (...v: (string | undefined)[]) =>
  v.map((x) => (x ?? "").trim()).filter(Boolean);

async function loadPng(name: string): Promise<string | undefined> {
  try {
    const f = await fs.readFile(path.join(process.cwd(), "public", name));
    return `data:image/png;base64,${f.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Render the service-contract PDF from the editor state (preview + download). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let state: ContractState | undefined;
  try {
    state = ((await req.json()) as { state?: ContractState }).state;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!state) return NextResponse.json({ error: "missing state" }, { status: 400 });

  const base = await loadIssuer();
  const name = state.issuerName?.trim() || base.senderName;
  const degree = (state.issuerDegree ?? base.degree ?? "").trim();
  const issuer = { ...base, senderName: degree ? `${name} ${degree}` : name };
  const issuerAddressLines = clean(state.issuerStreet, state.issuerCity, state.issuerCountry);

  const buffer = await renderToBuffer(
    ContractDocument({
      data: {
        contract: state,
        issuer,
        issuerAddressLines: issuerAddressLines.length ? issuerAddressLines : issuerAddress(base),
        recipientLines: clean(state.recipient.street, state.recipient.city, state.recipient.country),
        logoSrc: await loadPng("krileo-icon.png"),
        logoStackSrc: await loadPng("krileo-logo.png"),
      },
    }),
  );
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Krileo-Servicevertrag-${state.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
