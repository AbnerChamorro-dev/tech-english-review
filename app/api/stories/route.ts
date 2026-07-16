import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStoriesWithStatus } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const stories = await getStoriesWithStatus(db);
  return NextResponse.json(stories);
}
