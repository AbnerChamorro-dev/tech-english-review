import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reviewPhrase } from "@/lib/phrases";

export async function POST(req: Request) {
  const { phraseId, known } = await req.json();
  if (typeof phraseId !== "number" || typeof known !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const db = getDb();
  reviewPhrase(db, phraseId, known);
  return NextResponse.json({ ok: true });
}
