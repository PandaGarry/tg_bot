/**
 * Полоса объявлений для окон входа: одно сообщение за раз, вверху по центру, уходит сама.
 * Ошибки ядра и состояние связи — тем же способом.
 */

import { useEffect, useState } from "react";

export const NOTICE_MS = 4500;

export function Notice({ message, tone = "info", id }: { message: string | null; tone?: "info" | "error"; id: number }) {
  const [visible, setVisible] = useState(false);

  // Каждое новое объявление (новый id) показывается заново и уходит через NOTICE_MS.
  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [message, id]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+6px)] z-20 flex justify-center px-4" aria-live="polite">
      {message && visible ? (
        <p
          key={id}
          role="status"
          className={`pointer-events-auto max-w-[min(92%,360px)] rounded-xl border px-3 py-2 text-center text-[13px] leading-snug backdrop-blur-sm ${
            tone === "error"
              ? "border-rose-300/40 bg-stone-900/95 text-rose-100"
              : "border-stone-600 bg-stone-900/95 text-stone-100"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Очередь из одного объявления: новое заменяет старое, одинаковое — перезапускает показ. */
export function useNotice() {
  const [state, setState] = useState<{ message: string | null; tone: "info" | "error"; id: number }>({
    message: null,
    tone: "info",
    id: 0,
  });
  return {
    ...state,
    say(message: string, tone: "info" | "error" = "info") {
      setState((prev) => ({ message, tone, id: prev.id + 1 }));
    },
  };
}
