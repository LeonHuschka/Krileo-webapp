import { NextResponse } from "next/server";
import { generateDailyTasks } from "@/lib/lead-engine/daily-tasks";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  date?: string;
  caps?: Partial<Record<"call" | "instagram" | "linkedin", number>>;
};

export async function POST(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    /* allow empty body */
  }

  try {
    const result = await generateDailyTasks(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "task gen failed" },
      { status: 500 },
    );
  }
}
