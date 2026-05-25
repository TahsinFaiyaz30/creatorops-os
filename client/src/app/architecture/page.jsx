import AppShell from '../../components/layout/AppShell';

const areas = [
  'Multi-Platform Content Management',
  'AI-Powered Content Workflow',
  'Creator Team Collaboration Infrastructure'
];

const blocks = [
  ['Next.js frontend', 'Browser workflow for editor/admin demo'],
  ['Express API', 'Modular monolith with service boundaries'],
  ['MongoDB', 'Workspace-scoped operational records'],
  ['JWT + RBAC', 'Backend-enforced editor and creator_admin permissions'],
  ['AI service', 'Gemini/Groq optional with template-fallback guarantee'],
  ['Approval service', 'Review queue with comments and audit events'],
  ['Scheduling worker', 'Queued publishing simulator for demo reliability'],
  ['Socket.IO', 'workflow:event stream after persisted events']
];

export default function ArchitecturePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan">Judge briefing</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Architecture</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            CreatorOps OS solves the operations gap between content ideas, AI repurposing, approval,
            scheduling, and accountability for creator teams.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {areas.map(area => (
            <div key={area} className="rounded-lg border border-line bg-panel p-4">
              <div className="text-sm font-semibold text-cyan">{area}</div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-xl font-semibold text-white">System shape</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {blocks.map(([title, body]) => (
              <div key={title} className="rounded-lg border border-line bg-ink p-4">
                <div className="font-semibold text-white">{title}</div>
                <p className="mt-2 text-sm text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-xl font-semibold text-white">Reliability choices</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>Modular monolith, not fake microservices.</li>
              <li>No paid dependency required for the core demo.</li>
              <li>No local LLM, no Ollama, no GPU dependency.</li>
              <li>AI fallback keeps the workflow alive without API keys.</li>
              <li>Events persist before realtime broadcast.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-xl font-semibold text-white">Future scaling</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>Move worker jobs to Redis/BullMQ.</li>
              <li>Add real publishing adapters per platform.</li>
              <li>Add analytics ingestion and performance clustering.</li>
              <li>Add media asset storage and campaign reporting.</li>
              <li>Split services only when operational load requires it.</li>
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
