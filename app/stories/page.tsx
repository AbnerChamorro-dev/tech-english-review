"use client";

import { useEffect, useState } from "react";

interface Story {
  id: string;
  title: string;
  level: string;
  phraseCount: number;
  completed: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  A2: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  B1: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  B2: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  C1: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    fetch("/api/stories")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Story[]) => {
        setStories(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  };

  const retry = () => {
    setError(false);
    setLoading(true);
    load();
  };

  useEffect(load, []);

  const toggle = async (storyId: string, completed: boolean) => {
    try {
      const res = await fetch("/api/stories/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, completed: !completed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      return;
    }
    load();
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
        Marca las que ya completaste en tech-english
      </p>
      {stories.map((s) => (
        <button
          key={s.id}
          onClick={() => toggle(s.id, s.completed)}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
            s.completed
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
              : "border-gray-100 bg-white active:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
              s.completed
                ? "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800"
            }`}>
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
              <p className="text-xs text-gray-400">{s.phraseCount} frases</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_COLORS[s.level] ?? ""}`}>
            {s.level}
          </span>
        </button>
      ))}
    </div>
  );
}
