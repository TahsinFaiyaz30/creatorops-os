export default function AIResultPanel({ provider, count }) {
  if (!provider) return null;

  return (
    <div className="rounded-md border border-cyan/30 bg-cyan/10 p-3 text-sm text-cyan">
      Generated {count || 0} platform variants with provider: <span className="font-semibold">{provider}</span>
    </div>
  );
}
