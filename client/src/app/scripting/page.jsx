'use client';

import AppShell from '../../components/layout/AppShell';
import ScriptChatPanel from '../../components/scripting/ScriptChatPanel';

export default function ScriptingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">AI scripting conversation</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Script AI</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">Create, revise, shorten, expand, or platform-optimize scripts. Gemini/Groq are optional; JavaScript fallback keeps the feature working.</p>
        </header>
        <ScriptChatPanel />
      </div>
    </AppShell>
  );
}
