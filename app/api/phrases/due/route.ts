import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { getDuePhrases } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getClient();
  const phrases = await getDuePhrases(db, 50);
  return NextResponse.json(phrases);
}
