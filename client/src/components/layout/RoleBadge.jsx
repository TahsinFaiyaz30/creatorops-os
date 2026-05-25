export default function RoleBadge({ role }) {
  const isAdmin = role === 'creator_admin';
  const isBrand = role === 'brand_rep';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isBrand
          ? 'border-purple-400/40 bg-purple-400/10 text-purple-200'
          : isAdmin
          ? 'border-gold/40 bg-gold/10 text-gold'
          : 'border-cyan/40 bg-cyan/10 text-cyan'
      }`}
    >
      {isBrand ? 'Brand Rep' : isAdmin ? 'Creator/Admin' : 'Editor'}
    </span>
  );
}
