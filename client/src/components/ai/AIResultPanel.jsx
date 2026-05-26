export default function AIResultPanel({ provider, count }) {
  if (!provider) return null;

  return (
    <div className="rounded-xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint">
      Generated {count || 0} platform variants with provider: <span className="font-semibold">{provider}</span>
    </div>
  );
}
