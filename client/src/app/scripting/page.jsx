'use client';

/**
 * Script AI — POST /api/ai/script, GET /api/scripts, GET /api/scripts/:id,
 * POST /api/scripts/:id/convert-to-content
 *
 * Header matches Dashboard / Campaigns / Compose. The metric row reads from
 * GET /api/scripts, which no client code called before this page.
 */

import { useEffect, useMemo, useState } from 'react';

import AppShell from '../../components/layout/AppShell';
import ScriptChatPanel from '../../components/scripting/ScriptChatPanel';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { BackgroundBeams } from '../../components/ui/background-beams';
import { Page } from '../../components/ds';
import { api } from '../../lib/api';

export default function ScriptingPage() {
  const [conversations, setConversations] = useState(null);

  useEffect(() => {
    api
      .get('/api/scripts')
      .then(p => setConversations(p?.data?.conversations || []))
      .catch(() => setConversations([]));
  }, []);

  const stats = useMemo(() => {
    if (!conversations) return null;
    const withFinal = conversations.filter(c => c.finalScript?.title);
    const providers = new Set(conversations.map(c => c.aiProvider).filter(Boolean));
    const latest = conversations
      .map(c => new Date(c.updatedAt || c.createdAt || 0).getTime())
      .sort((a, b) => b - a)[0];
    return {
      threads: conversations.length,
      finals: withFinal.length,
      messages: conversations.reduce((s, c) => s + (c.messages?.length || 0), 0),
      provider: providers.size ? [...providers][0] : 'fallback',
      lastActive: latest
        ? new Date(latest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '—'
    };
  }, [conversations]);

  return (
    <AppShell>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackgroundBeams className="opacity-25 dark:opacity-50" />
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
      </div>

      <Page>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Create
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Script AI
          </h1>
          <div className="max-w-3xl">
            <TextGenerateEffect
              words="Draft, revise, shorten, expand or re-platform a script in conversation. Gemini and Groq are optional — a JavaScript fallback keeps the room working without a key."
              className="font-normal"
              duration={0.5}
            />
          </div>
        </div>

        {/*
          The four oversized stat tiles are gone. This is a writing surface, and
          counting your own threads above the thing you came here to write in
          pushed the chat below the fold for no working benefit.
        */}
        {stats ? (
          <p className="text-xs text-[var(--muted)]">
            {stats.threads} thread{stats.threads === 1 ? '' : 's'} · {stats.finals} final script
            {stats.finals === 1 ? '' : 's'} · engine {stats.provider}
            {stats.lastActive !== '—' ? ` · last active ${stats.lastActive}` : ''}
          </p>
        ) : null}

        <ScriptChatPanel />
      </Page>
    </AppShell>
  );
}
