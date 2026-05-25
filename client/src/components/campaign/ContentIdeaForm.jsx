'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';

export default function ContentIdeaForm({ onCreate }) {
  const [form, setForm] = useState({
    title: '',
    rawIdea: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate(form);
      setForm({ title: '', rawIdea: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-base font-semibold text-white">New Content Idea</h2>
      <div className="mt-4 grid gap-3">
        <input
          className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
          placeholder="Title"
          value={form.title}
          onChange={event => setForm({ ...form, title: event.target.value })}
          required
        />
        <textarea
          className="focus-ring min-h-24 rounded-md border border-line bg-ink px-3 py-2 text-sm text-white"
          placeholder="Raw content idea"
          value={form.rawIdea}
          onChange={event => setForm({ ...form, rawIdea: event.target.value })}
          required
        />
      </div>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-ink hover:bg-green-300"
      >
        <Lightbulb size={16} />
        {busy ? 'Creating...' : 'Create idea'}
      </button>
    </form>
  );
}
