import { getCachedAudio, setCachedAudio } from "./audio-cache";

// Dedupe concurrent requests for the same text so the pre-fetch worker and the
// autoplay effect don't both hit /api/tts for the first phrase.
const inFlight = new Map<string, Promise<Blob>>();

async function requestTTS(text: string): Promise<Blob> {
  const cached = await getCachedAudio(text);
  if (cached) return cached;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status}`);
  }
  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("audio/")) {
    throw new Error(`TTS returned non-audio response: ${contentType}`);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("TTS returned empty audio");
  }

  await setCachedAudio(text, blob);
  return blob;
}

export function fetchTTS(text: string): Promise<Blob> {
  const existing = inFlight.get(text);
  if (existing) return existing;

  const promise = requestTTS(text).finally(() => {
    inFlight.delete(text);
  });
  inFlight.set(text, promise);
  return promise;
}
