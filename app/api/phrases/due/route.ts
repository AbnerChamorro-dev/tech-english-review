import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDuePhrases } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const phrases = await getDuePhrases(db, 50);
  return NextResponse.json(phrases);
}
