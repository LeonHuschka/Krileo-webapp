import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Capture REAL desktop + mobile screenshots of an order's work link via
// microlink (true device emulation — iPhone 11 for mobile), store them in the
// order-previews bucket, and save the public URLs on the order. Triggered from
// the order detail; no manual upload needed.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MICROLINK = "https://api.microlink.io/";

function microlinkShot(workUrl: string, device: "desktop" | "mobile"): string {
  const p = new URLSearchParams({
    url: workUrl,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
  });
  if (device === "mobile") p.set("device", "iPhone 11");
  return `${MICROLINK}?${p.toString()}`;
}

export async function POST(
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

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("work_url")
    .eq("id", params.id)
    .single();
  if (orderErr || !order?.work_url) {
    return NextResponse.json(
      { error: "Kein Arbeits-Link zum Aufnehmen." },
      { status: 400 },
    );
  }
  const workUrl = order.work_url.trim();

  const results = await Promise.all(
    (["desktop", "mobile"] as const).map(async (device) => {
      try {
        const res = await fetch(microlinkShot(workUrl, device), {
          cache: "no-store",
        });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength < 1000) return null; // guard against error placeholders
        const path = `${params.id}/${device}-${Date.now()}.png`;
        const { error } = await supabase.storage
          .from("order-previews")
          .upload(path, buf, { contentType: "image/png", upsert: true });
        if (error) return null;
        const { data } = supabase.storage
          .from("order-previews")
          .getPublicUrl(path);
        return { device, url: data.publicUrl };
      } catch {
        return null;
      }
    }),
  );

  const patch: {
    preview_desktop_url?: string;
    preview_mobile_url?: string;
  } = {};
  for (const r of results) {
    if (!r) continue;
    if (r.device === "desktop") patch.preview_desktop_url = r.url;
    else patch.preview_mobile_url = r.url;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Screenshots konnten nicht aufgenommen werden." },
      { status: 502 },
    );
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...patch });
}
