"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTTS } from "@/lib/tts-client";
import { getCachedKeys } from "@/lib/audio-cache";

interface Story {
  id: string;
  title: string;
  level: string;
  phraseCount: number;
  completed: boolean;
  phrases: string[];
}

const LEVEL_COLORS: Record<string, string> = {
  A2: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  B1: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  B2: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  C1: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<
    Record<string, { done: number; total: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refreshDownloaded = useCallback(async (list: Story[]) => {
    try {
      const keys = await getCachedKeys();
      const dl = new Set<string>();
      for (const s of list) {
        if (s.phrases.length > 0 && s.phrases.every((t) => keys.has(t))) {
          dl.add(s.id);
        }
      }
      setDownloadedIds(dl);
    } catch {
      /* cache unavailable; leave download state empty */
    }
  }, []);

  const load = useCallback(() => {
    return fetch("/api/stories")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Story[]) => {
        setStories(data);
        setLoading(false);
        void refreshDownloaded(data);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }, [refreshDownloaded]);

  const retry = () => {
    setError(false);
    setLoading(true);
    void load();
  };

  useEffect(() => {
    void load();
  }, [load]);

  // Download and cache every phrase's audio so the story can be reviewed
  // without a connection. Runs when a story is marked complete, or on demand.
  const downloadStoryAudio = useCallback(async (story: Story) => {
    const texts = story.phrases;
    if (texts.length === 0) {
      setDownloadedIds((s) => new Set(s).add(story.id));
      return;
    }
    const total = texts.length;
    setDownloading((d) => ({ ...d, [story.id]: { done: 0, total } }));

    let idx = 0;
    let done = 0;
    let failed = false;
    const concurrency = 3;
    const worker = async () => {
      while (idx < texts.length) {
        const i = idx++;
        try {
          await fetchTTS(texts[i]);
        } catch {
          failed = true;
        }
        done++;
        setDownloading((d) => ({ ...d, [story.id]: { done, total } }));
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, texts.length) }, () => worker())
    );

    setDownloading((d) => {
      const next = { ...d };
      delete next[story.id];
      return next;
    });
    if (!failed) {
      setDownloadedIds((s) => new Set(s).add(story.id));
    }
  }, []);

  const toggle = async (story: Story) => {
    const nextCompleted = !story.completed;
    try {
      const res = await fetch("/api/stories/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id, completed: nextCompleted }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      return;
    }
    await load();
    if (nextCompleted) void downloadStoryAudio(story);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 pt-10">
        <p className="text-sm text-gray-500">No se pudieron cargar las stories.</p>
        <button
          onClick={retry}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white active:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Stories</h1>
      <p className="mb-2 text-sm text-gray-400">
        Marca las que completaste; su audio se descarga para escuchar sin conexión
      </p>
      {stories.map((s) => {
        const progress = downloading[s.id];
        const isDownloaded = downloadedIds.has(s.id);
        return (
          <div
            key={s.id}
            className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
              s.completed
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
            }`}
          >
            <button
              onClick={() => toggle(s)}
              className="flex flex-1 items-center gap-3 text-left active:scale-[0.98]"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                  s.completed
                    ? "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                }`}
              >
                {s.completed ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  s.phraseCount
                )}
              </div>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-gray-400">
                  {s.phraseCount} frases
                  {isDownloaded && " · audio guardado"}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 pl-2">
              {progress ? (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  {progress.done}/{progress.total}
                </span>
              ) : isDownloaded ? (
                <span
                  title="Audio guardado para escuchar sin conexión"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              ) : s.completed ? (
                <button
                  onClick={() => downloadStoryAudio(s)}
                  title="Descargar audio para escuchar sin conexión"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 active:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              ) : null}
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_COLORS[s.level] ?? ""}`}>
                {s.level}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
