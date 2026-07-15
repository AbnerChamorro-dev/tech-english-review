import { NextResponse } from "next/server";
import OpenAI from "openai";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }

  const hash = crypto.createHash("sha1").update(text).digest("hex");
  const filePath = path.join(process.cwd(), "public", "audio", `${hash}.mp3`);

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
    });
  }

  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: "alloy",
    input: text,
    speed: 1.15,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return new NextResponse(buffer, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
  });
}
