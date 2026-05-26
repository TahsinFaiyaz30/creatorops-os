export default function RoleBadge({ role }) {
  const config = {
    creator_admin: {
      label: 'Creator / Admin',
      cls: 'border-gold/40 bg-gold/10 text-gold dark:text-gold',
    },
    brand_rep: {
      label: 'Brand Rep',
      cls: 'border-purple-400/40 bg-purple-400/10 text-purple-600 dark:text-purple-200',
    },
    editor: {
      label: 'Content Creator',
      cls: 'border-mint/40 bg-mint/10 text-mint dark:text-mint',
    },
  };
  const { label, cls } = config[role] || config.editor;

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
