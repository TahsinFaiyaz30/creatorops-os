'use client';

import AppShell from '../../components/layout/AppShell';
import ScriptChatPanel from '../../components/scripting/ScriptChatPanel';

export default function ScriptingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-mint">AI scripting conversation</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Script AI</h1>
          <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">Create, revise, shorten, expand, or platform-optimize scripts. Gemini/Groq are optional; JavaScript fallback keeps the feature working.</p>
        </header>
        <ScriptChatPanel />
      </div>
    </AppShell>
  );
}
