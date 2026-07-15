import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markStoryComplete, markStoryIncomplete } from "@/lib/phrases";

export async function POST(req: Request) {
  const { storyId, completed } = await req.json();
  if (typeof storyId !== "string" || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const db = getDb();
  if (completed) {
    markStoryComplete(db, storyId);
  } else {
    markStoryIncomplete(db, storyId);
  }
  return NextResponse.json({ ok: true });
}
