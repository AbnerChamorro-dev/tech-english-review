import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { reviewPhrase } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { phraseId, known } = await req.json();
  if (typeof phraseId !== "number" || typeof known !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const db = getClient();
  await reviewPhrase(db, phraseId, known);
  return NextResponse.json({ ok: true });
}
