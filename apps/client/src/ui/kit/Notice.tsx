/**
 * Полоса объявлений для окон входа: одно сообщение за раз, по центру, скрывается само.
 * Как в `docs/design/hud-court.md` (бегущая строка объявлений): не шире 62 % и 250 px, без перекрытия форм.
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
    <div className="auth-notice-slot" aria-live="polite">
      {message && visible ? (
        <p key={id} role="status" className={`auth-notice auth-notice-${tone}`}>
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
