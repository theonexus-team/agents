"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

type Toast = { id: number; message: string };

const ToastCtx = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);

  const toast = useCallback((message: string) => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-8"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise flex max-w-sm items-center gap-2.5 rounded-full border border-gold-400/30 bg-plum-950/95 px-5 py-3 text-sm text-ivory-50 shadow-[var(--shadow-float)] backdrop-blur"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-gold-300" strokeWidth={1.5} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
