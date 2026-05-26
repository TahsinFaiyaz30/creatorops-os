import { ROLES, getRoleLabel, normalizeRole } from '../../lib/roles';

export default function RoleBadge({ role }) {
  const config = {
    [ROLES.CONTENT_CREATOR]: {
      label: getRoleLabel(ROLES.CONTENT_CREATOR),
      cls: 'border-mint/40 bg-mint/10 text-mint dark:text-mint',
    },
    [ROLES.BRAND_REP]: {
      label: getRoleLabel(ROLES.BRAND_REP),
      cls: 'border-purple-400/40 bg-purple-400/10 text-purple-600 dark:text-purple-200',
    }
  };
  const { label, cls } = config[normalizeRole(role)] || config[ROLES.CONTENT_CREATOR];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
