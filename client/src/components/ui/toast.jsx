'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Toasts.
 *
 * Action results used to be rendered inline: every page kept a `message` or
 * `error` string in state and dropped a <Notice> into the layout when it was
 * set. That has two costs. The banner reflows whatever is under it, so the page
 * jumps at the exact moment you are reading it; and on a long screen the notice
 * often appears above the fold while you are working at the bottom, so a failed
 * save looks like nothing happened at all.
 *
 * The API is a module-level singleton rather than a context hook:
 *
 *     import { toast } from '@/components/ui/toast';
 *     toast.success('Saved.');
 *     toast.error(error.message);
 *
 * That matters because most callers are inside async handlers, effects and
 * plain helper functions — places a hook cannot reach. `<Toaster />` subscribes
 * to the singleton and is mounted once in the root layout. Calls made before it
 * mounts are queued, so a toast fired during the first render is not lost.
 *
 * Persistent, explanatory state stays inline. A toast is for something that
 * just happened; a banner is for something that is still true.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];
const DEFAULT_DURATION = 4200;
/* Failures stay long enough to read a server message and act on it. */
const ERROR_DURATION = 7000;
const MAX_VISIBLE = 4;

const listeners = new Set();
let pending = [];
let sequence = 0;

const emit = action => {
  if (listeners.size === 0) {
    /* No Toaster yet (first paint, or a toast fired from a module top level).
       Hold it rather than dropping it on the floor. */
    if (action.type === 'add') pending.push(action.toast);
    return;
  }
  listeners.forEach(listener => listener(action));
};

const push = (tone, message, options = {}) => {
  const text = typeof message === 'string' ? message.trim() : String(message?.message || '').trim();
  if (!text) return '';

  const id = options.id || `toast-${++sequence}`;
  emit({
    type: 'add',
    toast: {
      id,
      tone,
      message: text,
      title: options.title || '',
      duration:
        options.duration ?? (tone === 'danger' || tone === 'warning' ? ERROR_DURATION : DEFAULT_DURATION),
      action: options.action || null
    }
  });
  return id;
};

export const toast = {
  success: (message, options) => push('success', message, options),
  /* `error` takes an Error or a string, so `catch(e => toast.error(e))` works. */
  error: (message, options) => push('danger', message, options),
  warning: (message, options) => push('warning', message, options),
  info: (message, options) => push('info', message, options),
  show: (message, options) => push(options?.tone || 'info', message, options),
  dismiss: id => emit({ type: 'remove', id }),
  clear: () => emit({ type: 'clear' })
};

/**
 * Drop-in replacement for the `useState('')` a page kept purely to feed a
 * banner: same tuple, same setter signature, but setting a non-empty value also
 * raises a toast.
 *
 * It keeps the state rather than discarding it because several screens read the
 * value for more than the banner — `error && !data` renders a whole-page
 * failure state, for instance — and losing that would turn a visible error into
 * an empty screen.
 */
export function useToastState(tone = 'info', initial = '') {
  const [value, setValue] = useState(initial);

  const set = useCallback(
    next => {
      const text = typeof next === 'string' ? next : String(next?.message || '');
      setValue(text);
      if (text) push(tone === 'error' ? 'danger' : tone, text);
    },
    [tone]
  );

  return [value, set];
}

const TONE = {
  success: {
    icon: CheckCircle2,
    ring: 'border-success/40',
    accent: 'text-success',
    glow: 'shadow-[0_18px_50px_-20px_rgba(16,185,129,0.55)]'
  },
  danger: {
    icon: XCircle,
    ring: 'border-danger/45',
    accent: 'text-danger',
    glow: 'shadow-[0_18px_50px_-20px_rgba(239,68,68,0.55)]'
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-warning/45',
    accent: 'text-warning',
    glow: 'shadow-[0_18px_50px_-20px_rgba(245,158,11,0.5)]'
  },
  info: {
    icon: Info,
    ring: 'border-[var(--accent-line)]',
    accent: 'text-[var(--accent)]',
    glow: 'shadow-[0_18px_50px_-20px_var(--glow)]'
  }
};

function ToastRow({ item, onDismiss }) {
  const tone = TONE[item.tone] || TONE.info;
  const Icon = tone.icon;
  const timerRef = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !item.duration) return undefined;
    timerRef.current = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timerRef.current);
  }, [paused, item.duration, item.id, onDismiss]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ duration: 0.28, ease: EASE }}
      /* Hovering holds the toast open — a long error message should not vanish
         while it is being read. */
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto flex w-[min(22rem,calc(100vw-2rem))] items-start gap-2.5 rounded-2xl border ${tone.ring} bg-[var(--surface)]/95 px-3.5 py-3 backdrop-blur-xl ${tone.glow}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.accent}`} aria-hidden />

      <div className="min-w-0 flex-1">
        {item.title ? (
          <p className="text-xs font-bold tracking-tight text-[var(--text)]">{item.title}</p>
        ) : null}
        <p className={`text-[13px] leading-relaxed text-[var(--text-2)] ${item.title ? 'mt-0.5' : ''}`}>
          {item.message}
        </p>
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action.onClick?.();
              onDismiss(item.id);
            }}
            className={`focus-ring mt-1.5 rounded text-[11px] font-semibold ${tone.accent} hover:underline`}
          >
            {item.action.label}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="focus-ring -mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

export function Toaster() {
  const [items, setItems] = useState([]);
  const [mounted, setMounted] = useState(false);

  const dismiss = useCallback(id => setItems(list => list.filter(item => item.id !== id)), []);

  useEffect(() => {
    setMounted(true);

    const listener = action => {
      if (action.type === 'add') {
        setItems(list => {
          /* Same id twice replaces rather than stacks, so a handler that retries
             cannot pile up five copies of one failure. */
          const without = list.filter(item => item.id !== action.toast.id);
          return [...without, action.toast].slice(-MAX_VISIBLE);
        });
        return;
      }
      if (action.type === 'remove') dismiss(action.id);
      if (action.type === 'clear') setItems([]);
    };

    listeners.add(listener);

    if (pending.length > 0) {
      const queued = pending;
      pending = [];
      queued.forEach(item => listener({ type: 'add', toast: item }));
    }

    return () => listeners.delete(listener);
  }, [dismiss]);

  if (!mounted) return null;

  return createPortal(
    <ul
      /* aria-live so the message is announced; the region itself is inert so it
         never blocks clicks on the page behind it. */
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-2"
    >
      <AnimatePresence initial={false}>
        {items.map(item => (
          <ToastRow key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </ul>,
    document.body
  );
}

export default Toaster;
