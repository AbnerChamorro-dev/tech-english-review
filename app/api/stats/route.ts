import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReviewStats } from "@/lib/phrases";

export async function GET() {
  const db = getDb();
  const stats = getReviewStats(db);
  return NextResponse.json(stats);
}
