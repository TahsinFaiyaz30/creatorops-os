export default function RoleBadge({ role }) {
  const isAdmin = role === 'creator_admin';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isAdmin
          ? 'border-gold/40 bg-gold/10 text-gold'
          : 'border-cyan/40 bg-cyan/10 text-cyan'
      }`}
    >
      {isAdmin ? 'Creator/Admin' : 'Editor'}
    </span>
  );
}
