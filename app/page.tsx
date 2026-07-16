"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  learning: number;
  new: number;
  review: number;
  lapsed: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch(() => setError(true));
  };

  const retry = () => {
    setError(false);
    load();
  };

  useEffect(load, []);

  const due = stats ? stats.learning + stats.new + stats.review + stats.lapsed : 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Hoy</h1>

      {error ? (
        <div className="rounded-2xl bg-gray-100 p-4 text-center dark:bg-gray-900">
          <p className="text-sm text-gray-500">No se pudieron cargar las estadísticas.</p>
          <button
            onClick={retry}
            className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white active:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-blue-50 p-4 text-center dark:bg-blue-950">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{due}</p>
              <p className="mt-1 text-xs text-gray-500">Pendientes</p>
            </div>
            <div className="rounded-2xl bg-gray-100 p-4 text-center dark:bg-gray-900">
              <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">{stats.total}</p>
              <p className="mt-1 text-xs text-gray-500">Total</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-yellow-50 p-3 text-center dark:bg-yellow-950">
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.learning}</p>
              <p className="text-[10px] text-gray-500">Aprendiendo</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 text-center dark:bg-purple-950">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{stats.new}</p>
              <p className="text-[10px] text-gray-500">Nuevas</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-950">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.review}</p>
              <p className="text-[10px] text-gray-500">Repaso</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-950">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{stats.lapsed}</p>
              <p className="text-[10px] text-gray-500">Olvidadas</p>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />
          ))}
        </div>
      )}

      <Link
        href="/review"
        className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 active:bg-blue-700"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Empezar repaso
      </Link>

      <Link
        href="/stories"
        className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-4 text-lg font-semibold transition-colors active:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
      >
        Gestionar stories
      </Link>
    </div>
  );
}
