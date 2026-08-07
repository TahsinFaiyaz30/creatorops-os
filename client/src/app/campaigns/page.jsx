'use client';

/**
 * Campaigns — GET/POST /api/campaigns
 *
 * Rebuilt on Aceternity: TextGenerateEffect header, BentoGrid roster, GlareCard
 * per campaign. Also surfaces GET /api/campaigns/:id/publish-summary, which the
 * server has always exposed and no page ever called — each card now shows its
 * real publish rollup instead of just a name and status.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GitBranch, Plus, Target, Radio, CheckCircle2, Clock, ArrowUpRight } from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import CampaignForm from '../../components/campaign/CampaignForm';
import ContentBoard from '../../components/campaign/ContentBoard';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { GlareCard } from '../../components/ui/glare-card';
import { BentoGrid } from '../../components/ui/bento-grid';
import { BackgroundBeams } from '../../components/ui/background-beams';
import {
  Page, Section, Badge, Button,
  EmptyState, Skeleton, GlareStat, GlareStatGrid, GLARE_TINTS, useStagger
} from '../../components/ds';
import { api } from '../../lib/api';
import { useToastState } from '../../components/ui/toast';

const STATUS_TONE = {
  active: 'success', live: 'success', draft: 'neutral',
  paused: 'warning', archived: 'neutral', completed: 'accent'
};

function CampaignCard({ campaign, summary }) {
  const id = campaign._id || campaign.id;
  const platforms = campaign.platforms || [];

  return (
    <Link href={`/campaigns/${id}`} className="focus-ring group block rounded-2xl">
      <GlareCard
        containerClassName="w-full [aspect-ratio:16/10]"
        className="flex flex-col justify-between bg-[var(--surface)] p-5"
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-bold tracking-tight text-[var(--text)]">
              {campaign.name}
            </h3>
            <Badge tone={STATUS_TONE[campaign.status] || 'neutral'}>{campaign.status || 'draft'}</Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--muted)]">
            <Target className="mt-0.5 h-3 w-3 shrink-0" />
            {campaign.goal || 'No goal set'}
          </p>
        </div>

        {/* Real publish rollup from /campaigns/:id/publish-summary */}
        {summary ? (
          <dl className="grid grid-cols-3 gap-1.5">
            {[
              { k: 'Published', v: summary.published ?? 0, I: CheckCircle2, t: 'text-success' },
              { k: 'Queued',    v: summary.queued ?? 0,    I: Clock,        t: 'text-warning' },
              { k: 'Failed',    v: summary.failed ?? 0,    I: Radio,        t: 'text-danger' }
            ].map(({ k, v, I, t }) => (
              <div
                key={k}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5"
              >
                <dt className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
                  <I className={`h-2.5 w-2.5 ${t}`} />
                  {k}
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1">
            {platforms.slice(0, 4).map(p => (
              <span
                key={p}
                className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--accent)]"
              >
                {p}
              </span>
            ))}
            {platforms.length > 4 ? (
              <span className="px-1 text-[9px] text-[var(--muted)]">+{platforms.length - 4}</span>
            ) : null}
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
        </div>
      </GlareCard>
    </Link>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [boardItems, setBoardItems] = useState([]);
  const [error, setError] = useToastState('danger');
  const [notice, setNotice] = useToastState('success');
  const { item } = useStagger(0.06);

  const load = async () => {
    try {
      const payload = await api.get('/api/campaigns');
      const list = payload?.data?.campaigns || [];
      setCampaigns(list);

      /* Publish summaries and content items, both per-campaign endpoints, fanned
         out in parallel. allSettled throughout so one failing campaign can't
         blank the page. There is no cross-campaign content endpoint, so the
         board's items are merged client-side. */
      const ids = list.map(c => c._id || c.id);
      const [summaryResults, contentResults] = await Promise.all([
        Promise.allSettled(ids.map(id => api.get(`/api/campaigns/${id}/publish-summary`))),
        Promise.allSettled(ids.map(id => api.get(`/api/content/campaign/${id}`)))
      ]);

      const map = {};
      ids.forEach((id, i) => {
        if (summaryResults[i].status === 'fulfilled') {
          const d = summaryResults[i].value?.data;
          map[id] = d?.summary || d || null;
        }
      });
      setSummaries(map);

      setBoardItems(
        contentResults.flatMap(r =>
          r.status === 'fulfilled' ? r.value?.data?.contentItems || r.value?.data?.items || [] : []
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async form => {
    try {
      await api.post('/api/campaigns', form);
      setNotice('Campaign created.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const stats = useMemo(() => {
    if (!campaigns) return null;
    const platforms = new Set(campaigns.flatMap(c => c.platforms || []));
    const roll = Object.values(summaries);
    return {
      total: campaigns.length,
      active: campaigns.filter(c => ['active', 'live'].includes(c.status)).length,
      platforms: platforms.size,
      published: roll.reduce((s, r) => s + (r?.published || 0), 0),
      queued: roll.reduce((s, r) => s + (r?.queued || 0), 0)
    };
  }, [campaigns, summaries]);

  return (
    <AppShell>
      {/* Ambient layer. `fixed` + negative z sits it behind the whole scroll
          container; pointer-events-none so it never eats clicks. Opacity is
          dropped in light mode where beams read as smudges. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-30 dark:opacity-60" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Plan</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Active Campaigns &amp; Planning
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="Every production line in flight — goals, target platforms, the live publish rollup, and the whole slate moving through the board below."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>


        {/* Same GlareStat treatment as the Dashboard's headline metrics —
            one shared component, so the two pages cannot drift apart. */}
        {stats ? (
          <GlareStatGrid>
            <GlareStat label="Campaigns" value={stats.total}     icon={GitBranch}    tint={GLARE_TINTS[0]} />
            <GlareStat label="Active"    value={stats.active}    icon={Radio}        tint={GLARE_TINTS[1]} />
            <GlareStat label="Platforms" value={stats.platforms} icon={Target}       tint={GLARE_TINTS[2]} />
            <GlareStat label="Published" value={stats.published} icon={CheckCircle2} tint={GLARE_TINTS[3]} />
            <GlareStat label="Queued"    value={stats.queued}    icon={Clock}        tint={GLARE_TINTS[4]} />
          </GlareStatGrid>
        ) : null}

        {/*
          Layout: 35% / 65% two-column from xl up. The form column is `sticky` so
          it stays in view while the right column scrolls, and Roster + Production
          Board stack in that right column. Previously the board sat full-width
          *below* the two columns, which left a tall empty gutter beside the short
          form — the dead space in the middle of the page.
        */}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,35fr)_65fr]">
          <div className="xl:sticky xl:top-20">
            <Section title="New campaign" description="Name it, set a goal, pick platforms.">
              {/* CampaignForm renders its own glass panel — no outer wrapper. */}
              <CampaignForm onCreate={create} />
            </Section>
          </div>

          <div className="min-w-0 space-y-5">
            <Section
              title="Roster"
              description={campaigns ? `${campaigns.length} total` : undefined}
              actions={
                <Button as="a" href="/compose" variant="secondary" size="sm">
                  <Plus className="h-3.5 w-3.5" /> Compose
                </Button>
              }
            >
              {!campaigns ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
                </div>
              ) : campaigns.length === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title="No campaigns yet"
                  description="Create one on the left. Each campaign groups raw ideas, generated variants, reviews and publishes into a single production line."
                />
              ) : (
                <BentoGrid className="mx-0 max-w-none grid-cols-1 gap-4 md:auto-rows-auto md:grid-cols-2">
                  {campaigns.map(c => (
                    <motion.div key={c._id || c.id} variants={item} initial="hidden" animate="visible">
                      <CampaignCard campaign={c} summary={summaries[c._id || c.id]} />
                    </motion.div>
                  ))}
                </BentoGrid>
              )}
            </Section>

            <Section
              title="Production board"
              description="Every content item across all campaigns, laned by its real workflow status."
            >
              <ContentBoard items={boardItems} onRefresh={load} />
            </Section>
          </div>
        </div>
      </Page>
    </AppShell>
  );
}
