import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 300;

export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "alloy",
      input: text,
      speed: 1.0,
      response_format: "mp3",
    });
    const audio = Buffer.from(await response.arrayBuffer());
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err) {
    console.error("TTS generation failed:", err);
    return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
  }
}
