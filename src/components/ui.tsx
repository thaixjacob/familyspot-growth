'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Shared shell pieces for the dashboard: a card with a title, and an
 * explanation bubble that works by TAP (not hover) so it's usable on a phone.
 */

const TIP_WIDTH = 256; // px — matches the w-64 below
const EDGE = 12; // keep this much clear of the screen edges

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  // Tap anywhere else (or Esc) to dismiss — no hover on touch devices.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    // Cards live inside scrollable panels; simplest correct behaviour is to close.
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  /**
   * Anchor the bubble to the viewport, not the card: a 256px bubble hanging off
   * a button in the left-hand column would otherwise run off a phone screen.
   */
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const width = Math.min(TIP_WIDTH, window.innerWidth - EDGE * 2);
    const left = Math.min(Math.max(EDGE, r.right - width), window.innerWidth - EDGE - width);
    setPos({ top: r.bottom + 6, left, width });
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        aria-label="O que é isto?"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        ?
      </button>
      {open && pos && (
        <span
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-50 rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Card({
  title,
  tip,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: string;
  tip?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(title || tip) && (
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            {tip && <InfoTip text={tip} />}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

/** Horizontal scroll container so wide tables never break the phone layout. */
export function Scroller({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 ${className}`}>{children}</div>;
}
