import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reviewPhrase } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { phraseId, known } = await req.json();
  if (typeof phraseId !== "number" || typeof known !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const db = await getDb();
  const ok = await reviewPhrase(db, phraseId, known);
  if (!ok) {
    return NextResponse.json({ error: "Phrase not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
