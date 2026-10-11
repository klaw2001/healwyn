'use client';

import { useCallback, useEffect, useId, useState } from 'react';

export interface DemoTourStep {
  id: string;
  app: 'web' | 'crm';
  path: string;
  target: string;
  title: string;
  body: string;
}

const STORAGE_KEY = 'hw_tour_step';
const ACTIVE = 'data-tour-active';

function readStep(count: number): number | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('tour');
    const raw = fromUrl ?? window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < count ? n : null;
  } catch {
    return null;
  }
}

function writeStep(step: number | null) {
  try {
    if (step === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, String(step));
  } catch {
    // Storage blocked: the tour still works on this page.
  }
}

/**
 * The guided tour in the demo bar. Steps live on both apps (different
 * origins), so a step's link carries `?tour=n` and each app remembers the step
 * for the tab. The current step's element gets an outline; nothing else on the
 * page changes.
 */
export function DemoTour({
  steps,
  app,
  urls,
}: {
  steps: readonly DemoTourStep[];
  app: 'web' | 'crm';
  /** Base URLs of the two apps, for steps on the other one. */
  urls: { web: string; crm: string };
}) {
  const panelId = useId();
  const [step, setStep] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = readStep(steps.length);
    if (saved !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the tour from the URL or this tab's storage
      setStep(saved);
      setOpen(true);
    }
  }, [steps.length]);

  const current = step === null ? undefined : steps[step];

  useEffect(() => {
    document.querySelectorAll(`[${ACTIVE}]`).forEach((el) => el.removeAttribute(ACTIVE));
    if (!open || !current || current.app !== app) return;
    const target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!target) return;
    target.setAttribute(ACTIVE, '');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return () => target.removeAttribute(ACTIVE);
  }, [open, current, app]);

  const go = useCallback(
    (next: number | null) => {
      setStep(next);
      writeStep(next);
      if (next === null) setOpen(false);
    },
    [setStep],
  );

  const href = (s: DemoTourStep, index: number) => {
    const base = s.app === app ? '' : urls[s.app].replace(/\/$/, '');
    return `${base}${s.path}${s.path.includes('?') ? '&' : '?'}tour=${index}`;
  };

  return (
    <div className="relative">
      <style>{`[${ACTIVE}]{outline:3px solid var(--hw-accent);outline-offset:6px;border-radius:0.5rem;}`}</style>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open && step === null) go(0);
          setOpen(!open);
        }}
        className="min-h-10 rounded-md border border-current px-3 text-sm font-semibold"
      >
        {open ? 'Hide tour' : step === null ? 'Start tour' : 'Show tour'}
      </button>
      {open && current && step !== null ? (
        <div
          id={panelId}
          role="region"
          aria-label="Guided tour"
          className="fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 text-ink shadow-soft"
        >
          <p className="text-xs font-semibold text-ink-muted" aria-live="polite">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="mt-1 font-sans text-lg font-bold">{current.title}</h2>
          <p className="mt-2 text-sm">{current.body}</p>
          {current.app !== app || (typeof window !== 'undefined' && window.location.pathname !== current.path) ? (
            <a
              href={href(current, step)}
              className="mt-3 inline-flex min-h-10 items-center font-semibold text-primary underline underline-offset-4"
            >
              Go to this step{current.app !== app ? ` in the ${current.app === 'crm' ? 'CRM' : 'website'}` : ''}
            </a>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => go(step - 1)}
              className="min-h-10 rounded-md border border-line-strong px-3 text-sm font-semibold disabled:opacity-50"
            >
              Back
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="min-h-10 rounded-md bg-primary px-3 text-sm font-semibold text-on-primary"
              >
                Next
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => go(null)}
              className="min-h-10 rounded-md px-3 text-sm font-semibold text-ink-muted underline underline-offset-4"
            >
              End tour
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
