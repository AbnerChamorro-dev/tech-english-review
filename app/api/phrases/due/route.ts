import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDuePhrases } from "@/lib/phrases";

export async function GET() {
  const db = getDb();
  const phrases = getDuePhrases(db, 50);
  return NextResponse.json(phrases);
}
