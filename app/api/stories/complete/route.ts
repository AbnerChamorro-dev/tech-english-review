import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markStoryComplete, markStoryIncomplete } from "@/lib/phrases";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { storyId, completed } = await req.json();
  if (typeof storyId !== "string" || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const db = await getDb();
  if (completed) {
    await markStoryComplete(db, storyId);
  } else {
    await markStoryIncomplete(db, storyId);
  }
  return NextResponse.json({ ok: true });
}
