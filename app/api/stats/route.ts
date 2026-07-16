import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReviewStats } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const stats = await getReviewStats(db);
  return NextResponse.json(stats);
}
