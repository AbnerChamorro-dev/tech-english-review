"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchTTS } from "@/lib/tts-client";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mountedRef = useRef(true);

  // A single AudioContext is reused across playbacks. Creating a fresh one per
  // clip (and starting playback before it resumes) is what clipped the first
  // words of each phrase.
  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const teardownAudio = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch {
        /* already stopped/ended */
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    ctxRef.current = new AudioContext();
    return () => {
      mountedRef.current = false;
      teardownAudio();
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, [teardownAudio]);

  useEffect(() => {
    fetch("/api/phrases/due")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(async (data: Phrase[]) => {
        if (!mountedRef.current) return;
        setPhrases(data);
        setLoading(false);
        if (data.length === 0) {
          setDone(true);
          return;
        }
        // Pre-fetch audio in background
        const concurrency = 3;
        let idx = 0;
        const worker = async () => {
          while (idx < data.length) {
            const i = idx++;
            try {
              await fetchTTS(data[i].en);
            } catch {
              /* skip failed pre-fetch; it will retry on demand */
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(concurrency, data.length) }, () => worker())
        );
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setLoading(false);
        setError(true);
      });
  }, []);

  const startPlayback = useCallback(
    async (text: string, isCancelled: () => boolean) => {
      teardownAudio();
      let blob: Blob;
      try {
        blob = await fetchTTS(text);
      } catch {
        if (!isCancelled() && mountedRef.current) setPlaying(false);
        return;
      }
      if (isCancelled() || !mountedRef.current) return;
      setPlaying(true);
      try {
        const ctx = getContext();
        // Resume before decoding/playing: a context that starts suspended
        // would advance its clock late and clip the first words.
        await ctx.resume();
        if (isCancelled() || !mountedRef.current) return;

        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (isCancelled() || !mountedRef.current) return;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 2.5;
        source.connect(gain);
        gain.connect(ctx.destination);

        source.onended = () => {
          if (!isCancelled() && mountedRef.current) setPlaying(false);
        };
        sourceRef.current = source;
        // AudioBufferSourceNode plays from the exact start of the buffer once
        // the context is running, so no leading audio is lost.
        source.start();
      } catch {
        if (!isCancelled() && mountedRef.current) setPlaying(false);
      }
    },
    [teardownAudio, getContext]
  );

  const playAudio = useCallback(
    (text: string) => {
      void startPlayback(text, () => false);
    },
    [startPlayback]
  );

  useEffect(() => {
    if (phrases.length === 0 || index >= phrases.length) return;
    const phrase = phrases[index];
    let cancelled = false;

    void startPlayback(phrase.en, () => cancelled);

    return () => {
      cancelled = true;
      teardownAudio();
    };
  }, [index, phrases, startPlayback, teardownAudio]);

  const review = useCallback(
    async (known: boolean) => {
      if (submitting) return;
      const phrase = phrases[index];
      setSubmitting(true);
      try {
        const res = await fetch("/api/phrases/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phraseId: phrase.id, known }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setShowTranslation(false);
      if (index + 1 >= phrases.length) {
        setDone(true);
      } else {
        setIndex(index + 1);
      }
    },
    [phrases, index, submitting]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Cargando frases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        <p className="text-lg font-semibold">No se pudieron cargar las frases</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white active:bg-blue-700"
        >
          Reintentar
        </button>
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
          disabled={submitting}
          className="rounded-2xl border border-red-200 bg-red-50 py-3.5 text-base font-semibold text-red-600 active:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:active:bg-red-900"
        >
          No la conozco
        </button>
        <button
          onClick={() => review(true)}
          disabled={submitting}
          className="rounded-2xl border border-green-200 bg-green-50 py-3.5 text-base font-semibold text-green-600 active:bg-green-100 disabled:opacity-50 dark:border-green-900 dark:bg-green-950 dark:text-green-400 dark:active:bg-green-900"
        >
          La conozco
        </button>
      </div>
    </div>
  );
}
