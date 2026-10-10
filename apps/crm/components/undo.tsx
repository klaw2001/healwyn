'use client';

import { Button } from '@healwyn/ui';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { changeStage } from '@/app/(app)/actions';

export interface StageMove {
  leadId: string;
  leadName: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
}

interface UndoContextValue {
  record: (move: StageMove) => void;
  notify: (message: string, tone?: 'info' | 'error') => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);
const STORAGE_KEY = 'hw_crm_undo';

export function useUndo(): UndoContextValue {
  const value = useContext(UndoContext);
  if (!value) throw new Error('useUndo must be used inside UndoProvider');
  return value;
}

/**
 * Stage moves can be undone for the rest of the session. The stack lives in
 * sessionStorage, so it survives navigation and reloads but not a new session.
 * An undo is itself a stage change, so the audit trail keeps both.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [stack, setStack] = useState<StageMove[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error'; undo: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring from sessionStorage once on mount
      if (saved) setStack(JSON.parse(saved) as StageMove[]);
    } catch {
      /* storage unavailable: undo still works for this page */
    }
  }, []);

  const persist = (next: StageMove[]) => {
    setStack(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-20)));
    } catch {
      /* ignore */
    }
  };

  const record = useCallback((move: StageMove) => {
    setStack((current) => {
      const next = [...current, move].slice(-20);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setToast({ message: `Moved ${move.leadName} to ${move.toLabel}.`, tone: 'info', undo: true });
  }, []);

  const notify = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone, undo: false });
  }, []);

  const undoLast = async () => {
    const last = stack.at(-1);
    if (!last) return;
    setBusy(true);
    const result = await changeStage(last.leadId, last.from, 'undo');
    setBusy(false);
    if (result.ok) {
      persist(stack.slice(0, -1));
      setToast({ message: `Moved ${last.leadName} back to ${last.fromLabel}.`, tone: 'info', undo: false });
      router.refresh();
    } else {
      setToast({ message: result.error, tone: 'error', undo: false });
    }
  };

  const value = useMemo(() => ({ record, notify }), [record, notify]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toast ? (
          <div
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-label="Notification"
            className={`pointer-events-auto flex max-w-xl items-center gap-4 rounded-lg px-4 py-3 shadow-lift ${
              toast.tone === 'error' ? 'bg-danger text-surface' : 'bg-ink text-bg'
            }`}
          >
            <span className="text-sm">{toast.message}</span>
            {toast.undo && stack.length ? (
              <Button size="sm" variant="accent" onClick={undoLast} disabled={busy}>
                {busy ? 'Undoing…' : 'Undo'}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto rounded px-2 text-sm underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </UndoContext.Provider>
  );
}
