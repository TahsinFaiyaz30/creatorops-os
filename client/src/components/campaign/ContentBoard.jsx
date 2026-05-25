import ContentCard from './ContentCard';

export default function ContentBoard({ items, variantsByContent, user, onRefresh }) {
  if (!items?.length) {
    return <div className="rounded-lg border border-line bg-panel p-6 text-sm text-slate-400">No content ideas yet.</div>;
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <ContentCard
          key={item._id}
          item={item}
          user={user}
          initialVariants={variantsByContent[item._id] || []}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
