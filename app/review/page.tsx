"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCachedAudio, setCachedAudio } from "@/lib/audio-cache";

interface Phrase {
  id: number;
  story_id: string;
  story_title: string;
  level: string;
  en: string;
  es: string;
  order: number;
  next_review: string | null;
}

export default function ReviewPage() {
  const router = useRouter();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [index, setIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetch("/api/phrases/due")
      .then((r) => r.json())
      .then((data: Phrase[]) => {
        if (!mountedRef.current) return;
        setPhrases(data);
        setLoading(false);
        if (data.length === 0) setDone(true);
      });
  }, []);

  const playAudio = useCallback(async (text: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(true);
    try {
      let blob = await getCachedAudio(text);
      if (!blob) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        blob = await res.blob();
        await setCachedAudio(text, blob);
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { if (mountedRef.current) setPlaying(false); };
      audio.onerror = () => { if (mountedRef.current) setPlaying(false); };
      await audio.play();
    } catch {
      if (mountedRef.current) setPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (phrases.length === 0 || index >= phrases.length) return;
    const phrase = phrases[index];
    let cancelled = false;

    const load = async () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: phrase.en }),
        });
        if (cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { if (!cancelled && mountedRef.current) setPlaying(false); };
        audio.onerror = () => { if (!cancelled && mountedRef.current) setPlaying(false); };
        await audio.play();
      } catch {
        if (!cancelled && mountedRef.current) setPlaying(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [index, phrases]);

  const review = useCallback(
    async (known: boolean) => {
      const phrase = phrases[index];
      await fetch("/api/phrases/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phraseId: phrase.id, known }),
      });
      setShowTranslation(false);
      if (index + 1 >= phrases.length) {
        setDone(true);
      } else {
        setIndex(index + 1);
      }
    },
    [phrases, index]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Cargando frases...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-2xl font-bold">Listo!</p>
        <p className="text-gray-500">Repasaste todas las frases de hoy.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 w-full rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white active:bg-blue-700"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const phrase = phrases[index];
  const progress = ((index + 1) / phrases.length) * 100;

  return (
    <div className="flex h-full flex-col py-2">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{index + 1} de {phrases.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="relative flex min-h-[240px] flex-col justify-center rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="absolute right-3 top-3 rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          {showTranslation ? "OCULTAR" : "ES"}
        </button>

        <p className="text-[11px] text-gray-400">{phrase.story_title} · {phrase.level}</p>
        <p className="mt-3 text-xl font-semibold leading-snug">{phrase.en}</p>

        {showTranslation && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{phrase.es}</p>
        )}
      </div>

      {/* Escuchar */}
      <button
        onClick={() => playAudio(phrase.en)}
        disabled={playing}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium transition-colors active:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        {playing ? "Escuchando..." : "Escuchar"}
      </button>

      {/* Acciones */}
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <button
          onClick={() => review(false)}
          className="rounded-2xl border border-red-200 bg-red-50 py-3.5 text-base font-semibold text-red-600 active:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:active:bg-red-900"
        >
          No la conozco
        </button>
        <button
          onClick={() => review(true)}
          className="rounded-2xl border border-green-200 bg-green-50 py-3.5 text-base font-semibold text-green-600 active:bg-green-100 dark:border-green-900 dark:bg-green-950 dark:text-green-400 dark:active:bg-green-900"
        >
          La conozco
        </button>
      </div>
    </div>
  );
}
