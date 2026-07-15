import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStoriesWithStatus } from "@/lib/phrases";

export async function GET() {
  const db = getDb();
  const stories = getStoriesWithStatus(db);
  return NextResponse.json(stories);
}
