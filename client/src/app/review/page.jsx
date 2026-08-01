'use client';

/**
 * Creator Review — GET /api/approvals/pending,
 * POST /api/approvals/:id/{approve,reject,request-changes}
 *
 * Layout: queue on the left, live workflow feed on the right. The feed is the
 * point — a decision here fires a WorkflowEvent, so you watch your own approval
 * land in the stream a second later.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Check, MessageSquareWarning, X } from 'lucide-react';

import AppShell from '../../components/layout/AppShell';
import ApprovalQueue from '../../components/approvals/ApprovalQueue';
import LiveEventFeed from '../../components/events/LiveEventFeed';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import { Page, Section, GlareStat, GlareStatGrid, GLARE_TINTS } from '../../components/ds';
import { getUser } from '../../lib/auth';

export default function CreatorReviewPage() {
  const [user, setUser] = useState(null);
  const [queue, setQueue] = useState({ pending: 0, decisions: [] });

  useEffect(() => { setUser(getUser()); }, []);

  /* useCallback so the child's effect doesn't re-fire on every render. */
  const handleStats = useCallback(stats => setQueue(stats), []);

  const stats = useMemo(() => {
    const d = queue.decisions || [];
    return {
      pending: queue.pending,
      approved: d.filter(x => x.approval?.status === 'approved').length,
      changes: d.filter(x => x.approval?.status === 'changes_requested').length,
      rejected: d.filter(x => x.approval?.status === 'rejected').length
    };
  }, [queue]);

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Review
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Creator Review
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="The last gate before anything ships. Every decision carries your comment back to the creator, and role permissions are enforced server-side — not hidden in the UI."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>

        <GlareStatGrid className="xl:grid-cols-4">
          <GlareStat label="Awaiting review" value={stats.pending}  icon={ShieldCheck}          tint={GLARE_TINTS[0]} />
          <GlareStat label="Approved"        value={stats.approved} icon={Check}                tint={GLARE_TINTS[3]} hint="This session" />
          <GlareStat label="Changes asked"   value={stats.changes}  icon={MessageSquareWarning} tint={GLARE_TINTS[2]} hint="This session" />
          <GlareStat label="Rejected"        value={stats.rejected} icon={X}                    tint={GLARE_TINTS[4]} hint="This session" />
        </GlareStatGrid>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Section
            title="Review queue"
            description={queue.pending ? `${queue.pending} awaiting a decision` : undefined}
          >
            <ApprovalQueue user={user} onStats={handleStats} />
          </Section>

          <div className="xl:sticky xl:top-20">
            <Section
              title="Live workflow"
              description="Your decision appears here moments after you make it."
            >
              <LiveEventFeed compact />
            </Section>
          </div>
        </div>
      </Page>
    </AppShell>
  );
}
