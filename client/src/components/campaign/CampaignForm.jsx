'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CampaignForm — rebuilt.
 *
 * Was: three unlabelled inputs and 11 native checkboxes, all checked by default.
 *
 * Now surfaces the platform metadata that already existed in lib/platforms.js
 * and was never rendered anywhere — caption limits, media capacity, supported
 * media types, tone and required elements. Picking platforms now tells you what
 * you're committing to:
 *   · tightest caption limit across the selection (the real governing constraint)
 *   · smallest media capacity across the selection
 *   · per-chip tooltip with limits + required elements
 *
 * The onCreate contract is unchanged: { name, goal, targetAudience, platforms }.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus, Check, CheckCheck, XCircle, Type, Images, Video,
  Sparkles, TriangleAlert, Info
} from 'lucide-react';

import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Surface, Badge, Button, Notice } from '../ds';
import {
  platformOptions,
  formatPlatform,
  getPlatformCaptionLimit,
  getPlatformDetails,
  platformCapabilities
} from '../../lib/platforms';

const EASE = [0.16, 1, 0.3, 1];

const emptyForm = () => ({
  name: '',
  goal: '',
  targetAudience: '',
  platforms: [...platformOptions]
});

/* ── One animated platform chip ───────────────────────────────────────────── */

function PlatformChip({ platform, selected, onToggle }) {
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
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className={`focus-ring relative flex w-full items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
          selected
            ? 'border-[var(--accent-line)] text-[var(--accent)]'
            : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
        }`}
      >
        {/* Per-chip fill. Multi-select rules out one shared layoutId, so each chip
            animates its own background. */}
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="pointer-events-none absolute inset-0 bg-[var(--accent-soft)]"
            />
          )}
        </AnimatePresence>

        <span
          className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]'
          }`}
        >
          <AnimatePresence>
            {selected && (
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              >
                <Check className="h-3 w-3 text-[var(--accent-fg)]" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <span className="relative min-w-0 truncate">{formatPlatform(platform)}</span>
      </motion.button>

      {/* Capability tooltip — metadata that previously had nowhere to live */}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EASE }}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface3)] p-2.5 shadow-[var(--shadow)]"
          >
            <p className="text-[11px] font-semibold text-[var(--text)]">
              {formatPlatform(platform)}
            </p>
            <dl className="mt-1.5 space-y-1 text-[10px] text-[var(--muted)]">
              <div className="flex items-center gap-1.5">
                <Type className="h-2.5 w-2.5" />
                {limit.toLocaleString()} char caption
              </div>
              <div className="flex items-center gap-1.5">
                <Images className="h-2.5 w-2.5" />
                up to {caps.maxMedia ?? 1} {caps.multiMedia ? 'items' : 'item'}
              </div>
              <div className="flex items-center gap-1.5">
                <Video className="h-2.5 w-2.5" />
                {(caps.types || ['image']).join(', ')}
              </div>
            </dl>
            {details.requirements?.length ? (
              <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[10px] leading-snug text-[var(--text-2)]">
                {details.requirements.join(' · ')}
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Field with a live character counter ──────────────────────────────────── */

function CountedField({ id, label, value, onChange, placeholder, max, required, hint }) {
  const pct = max ? Math.min(100, (value.length / max) * 100) : 0;
  const over = max && value.length > max;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-[var(--muted)]">
          {label}
          {required ? <span className="ml-0.5 text-[var(--accent)]">*</span> : null}
        </Label>
        {max ? (
          <span className={`text-[10px] tabular-nums ${over ? 'text-danger' : 'text-[var(--muted)]'}`}>
            {value.length}/{max}
          </span>
        ) : null}
      </div>
      <Input id={id} value={value} onChange={onChange} placeholder={placeholder} required={required} />
      {max ? (
        <div className="h-0.5 overflow-hidden rounded-full bg-[var(--surface3)]">
          <motion.div
            className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-[var(--accent)]'}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        </div>
      ) : null}
      {hint ? <p className="text-[10px] text-[var(--muted)]">{hint}</p> : null}
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

  /* Aggregate constraints. For a cross-posted campaign the tightest limit in the
     selection is the one that actually governs, so that's what gets surfaced. */
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
    <Surface as="form" onSubmit={submit} pad="md" className="space-y-4">
      {/* Header + readiness meter */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--text)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            Create Campaign
          </h2>
          <span className="text-[10px] font-semibold tabular-nums text-[var(--muted)]">
            {readiness}% ready
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface3)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#6344F5] to-[#AE48FF]"
            animate={{ width: `${readiness}%` }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        </div>
      </div>

      <CountedField
        id="cf-name"
        label="Campaign name"
        value={form.name}
        onChange={e => set('name', e.target.value)}
        placeholder="Q3 brand film rollout"
        max={80}
        required
      />
      <CountedField
        id="cf-goal"
        label="Goal"
        value={form.goal}
        onChange={e => set('goal', e.target.value)}
        placeholder="Drive 50k views and 500 saves"
        max={140}
      />
      <CountedField
        id="cf-audience"
        label="Target audience"
        value={form.targetAudience}
        onChange={e => set('targetAudience', e.target.value)}
        placeholder="Indie filmmakers, 18–34"
        max={140}
        hint="Feeds the AI tone when variants are generated."
      />

      {/* Platforms */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium text-[var(--muted)]">
            Platforms
            <Badge tone={form.platforms.length ? 'accent' : 'danger'} className="ml-2">
              {form.platforms.length}/{platformOptions.length}
            </Badge>
          </Label>
          <button
            type="button"
            onClick={() => set('platforms', allSelected ? [] : [...platformOptions])}
            className="focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
          >
            {allSelected ? <XCircle className="h-3 w-3" /> : <CheckCheck className="h-3 w-3" />}
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {platformOptions.map(platform => (
            <PlatformChip
              key={platform}
              platform={platform}
              selected={form.platforms.includes(platform)}
              onToggle={togglePlatform}
            />
          ))}
        </div>

        {/* Aggregate constraint readout */}
        <AnimatePresence mode="wait">
          {insight ? (
            <motion.div
              key="insight"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-2.5"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                <Info className="h-3 w-3" />
                Effective limits
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="warning">
                  <Type className="h-3 w-3" />
                  {insight.tightestCaption.toLocaleString()} chars · {insight.tightestCaptionPlatform}
                </Badge>
                <Badge>
                  <Images className="h-3 w-3" />
                  {insight.minMedia} media min
                </Badge>
              </div>
              {insight.videoOnly.length ? (
                <p className="text-[10px] leading-snug text-[var(--muted)]">
                  Video only: {insight.videoOnly.join(', ')}
                </p>
              ) : null}
            </motion.div>
          ) : (
            <motion.p
              key="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[11px] text-danger"
            >
              <TriangleAlert className="h-3 w-3 shrink-0" />
              Pick at least one platform.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button
        type="submit"
        variant="primary"
        disabled={busy || !form.name.trim() || !form.platforms.length}
        className="w-full"
      >
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Creating…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Create campaign
          </>
        )}
      </Button>
    </Surface>
  );
}
