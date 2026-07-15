import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: "alloy",
    input: text,
    speed: 1.15,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
