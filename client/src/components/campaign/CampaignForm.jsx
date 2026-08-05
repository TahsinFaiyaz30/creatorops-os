'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CampaignForm — briefing console.
 *
 * Direction change from the previous chip-grid version:
 *  · Circular readiness gauge instead of a linear bar.
 *  · Floating-label fields — the label rides up on focus/fill, so there's no
 *    separate label row eating vertical space.
 *  · Platform picker is a 3-up tile grid with per-platform marks, not a list of
 *    checkbox rows.
 *  · A LIVE PREVIEW of the campaign card renders below, mirroring the roster
 *    card exactly. This is what fills the empty column: instead of dead space
 *    under a short form, you see the thing you're about to create, updating as
 *    you type.
 *
 * Still surfaces the platform metadata from lib/platforms.js that nothing else
 * renders — caption limits, media capacity, media types — and computes the
 * governing constraint across the selection.
 *
 * onCreate contract unchanged: { name, goal, targetAudience, platforms }.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus, Check, CheckCheck, XCircle, Type, Images, Video,
  Target, TriangleAlert, Users, ArrowUpRight, Radio
} from 'lucide-react';

import { Badge, Notice } from '../ds';
import { AnimatedButton } from '../ui/AnimatedButton';
import {
  platformOptions,
  formatPlatform,
  getPlatformCaptionLimit,
  getPlatformDetails,
  platformCapabilities
} from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

/* Two-letter marks so tiles stay uniform without shipping brand logos. */
const MARKS = {
  facebook: 'Fb', instagram: 'Ig', tiktok: 'Tt', youtube: 'Yt',
  youtube_shorts: 'Sh', threads: 'Th', linkedin: 'In', x: 'X',
  pinterest: 'Pi', wordpress: 'Wp', shopify: 'Sp'
};

const emptyForm = () => ({
  name: '',
  goal: '',
  targetAudience: '',
  platforms: [...platformOptions]
});

/* ── Circular readiness gauge ─────────────────────────────────────────────── */

function ReadinessGauge({ value }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface3)" strokeWidth="3" />
        <motion.circle
          cx="18" cy="18" r={r}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6344F5" />
            <stop offset="100%" stopColor="#AE48FF" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-[var(--text)]">
        {value}
      </span>
    </div>
  );
}

/* ── Floating-label field ─────────────────────────────────────────────────── */

function FloatField({ id, label, value, onChange, max, required, textarea }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  const over = max && value.length > max;
  const Control = textarea ? 'textarea' : 'input';

  return (
    <div className="relative">
      <div
        className={`relative overflow-hidden rounded-xl border transition-colors ${
          focused
            ? 'border-[var(--accent-line)] bg-[var(--surface2)] shadow-[0_0_22px_-10px_var(--glow)]'
            : 'border-[var(--border)] bg-[var(--surface2)]/60 hover:border-[var(--border-strong)]'
        }`}
      >
        <Control
          id={id}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          rows={textarea ? 2 : undefined}
          className="peer w-full resize-none bg-transparent px-3 pb-2 pt-5 text-sm text-[var(--text)] outline-none"
        />
        <motion.label
          htmlFor={id}
          animate={{
            y: lifted ? -8 : 0,
            scale: lifted ? 0.82 : 1,
            color: focused ? 'var(--accent)' : 'var(--muted)'
          }}
          transition={{ duration: 0.18, ease: EASE }}
          className="pointer-events-none absolute left-3 top-3.5 origin-left text-sm font-medium"
        >
          {label}
          {required ? <span className="ml-0.5 text-[var(--accent)]">*</span> : null}
        </motion.label>

        {max ? (
          <span
            className={`absolute bottom-1.5 right-2.5 text-[9px] tabular-nums ${
              over ? 'text-danger' : 'text-[var(--muted)]'
            }`}
          >
            {value.length}/{max}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Platform tile ────────────────────────────────────────────────────────── */

function PlatformTile({ platform, selected, onToggle }) {
  const [hover, setHover] = useState(false);
  const caps = platformCapabilities[platform] || {};
  const details = getPlatformDetails(platform);
  const limit = getPlatformCaptionLimit(platform);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.button
        type="button"
        onClick={() => onToggle(platform)}
        aria-pressed={selected}
        aria-label={formatPlatform(platform)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 460, damping: 22 }}
        className={`focus-ring relative flex w-full flex-col items-center gap-1 overflow-hidden rounded-xl border px-1 py-2.5 transition-colors ${
          selected
            ? 'border-[var(--accent-line)] text-[var(--accent)] shadow-[0_0_20px_-8px_var(--glow)]'
            : 'border-[var(--border)] bg-[var(--surface2)]/50 text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
        }`}
      >
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="pointer-events-none absolute inset-0 bg-[var(--accent-soft)]"
            />
          )}
        </AnimatePresence>

        <span className="relative flex h-6 w-6 items-center justify-center rounded-md border border-current/30 text-[10px] font-bold">
          {MARKS[platform] || platform.slice(0, 2)}
        </span>
        <span className="relative w-full truncate text-center text-[9px] font-medium leading-tight">
          {formatPlatform(platform)}
        </span>

        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 540, damping: 20 }}
              className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--accent)]"
            >
              <Check className="h-2 w-2 text-[var(--accent-fg)]" strokeWidth={4} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: EASE }}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 w-48 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface3)]/95 p-2 shadow-[var(--shadow)] backdrop-blur-xl"
          >
            <p className="text-[10px] font-semibold text-[var(--text)]">{formatPlatform(platform)}</p>
            <dl className="mt-1 space-y-0.5 text-[9px] text-[var(--muted)]">
              <div className="flex items-center gap-1"><Type className="h-2 w-2" />{limit.toLocaleString()} chars</div>
              <div className="flex items-center gap-1"><Images className="h-2 w-2" />up to {caps.maxMedia ?? 1}</div>
              <div className="flex items-center gap-1"><Video className="h-2 w-2" />{(caps.types || ['image']).join(', ')}</div>
            </dl>
            {details.requirements?.length ? (
              <p className="mt-1 border-t border-[var(--border)] pt-1 text-[9px] leading-snug text-[var(--text-2)]">
                {details.requirements.join(' · ')}
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Live preview — mirrors the roster card ───────────────────────────────── */

function LivePreview({ form, insight }) {
  const named = form.name.trim();
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface2)]/30 p-2.5">
      <p className="mb-2 flex items-center gap-1.5 px-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        <Radio className="h-2.5 w-2.5 text-[var(--accent)]" />
        Live preview
      </p>

      <motion.div
        layout
        className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,var(--accent-soft),transparent_60%)]"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={`min-w-0 truncate text-sm font-bold tracking-tight ${
                named ? 'text-[var(--text)]' : 'text-[var(--muted)] italic'
              }`}
            >
              {named || 'Untitled campaign'}
            </h4>
            <Badge tone="neutral">draft</Badge>
          </div>

          <p className="mt-1.5 line-clamp-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
            <Target className="mt-0.5 h-3 w-3 shrink-0" />
            {form.goal.trim() || 'No goal set'}
          </p>

          {form.targetAudience.trim() ? (
            <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
              <Users className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{form.targetAudience}</span>
            </p>
          ) : null}

          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-wrap gap-1">
              {form.platforms.slice(0, 4).map(p => (
                <span
                  key={p}
                  className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[var(--accent)]"
                >
                  {p}
                </span>
              ))}
              {form.platforms.length > 4 ? (
                <span className="px-0.5 text-[8px] text-[var(--muted)]">
                  +{form.platforms.length - 4}
                </span>
              ) : null}
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          </div>
        </div>
      </motion.div>

      {/* Governing constraints */}
      <AnimatePresence mode="wait">
        {insight ? (
          <motion.div
            key="ins"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="mt-2 flex flex-wrap gap-1.5"
          >
            <Badge tone="warning">
              <Type className="h-3 w-3" />
              {insight.tightestCaption.toLocaleString()} · {insight.tightestCaptionPlatform}
            </Badge>
            <Badge>
              <Images className="h-3 w-3" />
              {insight.minMedia} media
            </Badge>
            {insight.videoOnly.length ? (
              <Badge tone="accent">
                <Video className="h-3 w-3" />
                {insight.videoOnly.length} video-only
              </Badge>
            ) : null}
          </motion.div>
        ) : (
          <motion.p
            key="warn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2 py-1.5 text-[10px] text-danger"
          >
            <TriangleAlert className="h-3 w-3 shrink-0" />
            Pick at least one platform.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Form ─────────────────────────────────────────────────────────────────── */

export default function CampaignForm({ onCreate }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(c => ({ ...c, [key]: value }));

  const togglePlatform = platform =>
    setForm(c => ({
      ...c,
      platforms: c.platforms.includes(platform)
        ? c.platforms.filter(p => p !== platform)
        : [...c.platforms, platform]
    }));

  const insight = useMemo(() => {
    if (!form.platforms.length) return null;
    const limits = form.platforms.map(getPlatformCaptionLimit);
    const media = form.platforms.map(p => platformCapabilities[p]?.maxMedia ?? 1);
    const minLimit = Math.min(...limits);
    const videoOnly = form.platforms.filter(p => {
      const t = platformCapabilities[p]?.types || [];
      return t.length === 1 && t[0] === 'video';
    });
    return {
      tightestCaption: minLimit,
      tightestCaptionPlatform: formatPlatform(form.platforms[limits.indexOf(minLimit)]),
      minMedia: Math.min(...media),
      videoOnly: videoOnly.map(formatPlatform)
    };
  }, [form.platforms]);

  const readiness = useMemo(() => {
    const checks = [
      Boolean(form.name.trim()),
      Boolean(form.goal.trim()),
      Boolean(form.targetAudience.trim()),
      form.platforms.length > 0
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const allSelected = form.platforms.length === platformOptions.length;
  const canSubmit = Boolean(form.name.trim()) && form.platforms.length > 0 && !busy;

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate(form);
      setForm(emptyForm());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)] blur-2xl"
      />

      <div className="relative space-y-3.5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ReadinessGauge value={readiness} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-[var(--text)]">
              New campaign
            </h2>
            <p className="text-[10px] text-[var(--muted)]">
              {readiness === 100 ? 'Brief complete' : 'Fill the brief to sharpen AI output'}
            </p>
          </div>
        </div>

        <FloatField
          id="cf-name"
          label="Campaign name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          max={80}
          required
        />
        <FloatField
          id="cf-goal"
          label="Goal"
          value={form.goal}
          onChange={e => set('goal', e.target.value)}
          max={140}
        />
        <FloatField
          id="cf-audience"
          label="Target audience"
          value={form.targetAudience}
          onChange={e => set('targetAudience', e.target.value)}
          max={140}
          textarea
        />

        {/* Platform tiles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Platforms
              <Badge tone={form.platforms.length ? 'accent' : 'danger'}>
                {form.platforms.length}/{platformOptions.length}
              </Badge>
            </span>
            <AnimatedButton
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => set('platforms', allSelected ? [] : [...platformOptions])}
              className="text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              {allSelected ? <XCircle className="h-3 w-3" /> : <CheckCheck className="h-3 w-3" />}
              {allSelected ? 'Clear' : 'All'}
            </AnimatedButton>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {platformOptions.map(platform => (
              <PlatformTile
                key={platform}
                platform={platform}
                selected={form.platforms.includes(platform)}
                onToggle={togglePlatform}
              />
            ))}
          </div>
        </div>

        {/* Fills the column: shows exactly what will be created */}
        <LivePreview form={form} insight={insight} />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {/* The hand-rolled shimmer this used to carry now lives in AnimatedButton,
            so the CTA stays in step with every other primary on the platform. */}
        <AnimatedButton
          type="submit"
          size="lg"
          variant={canSubmit ? 'primary' : 'secondary'}
          disabled={!canSubmit}
          loading={busy}
          className="w-full"
        >
          {busy ? 'Creating…' : (
            <>
              <Plus className="h-4 w-4" />
              Create campaign
            </>
          )}
        </AnimatedButton>
      </div>
    </form>
  );
}
