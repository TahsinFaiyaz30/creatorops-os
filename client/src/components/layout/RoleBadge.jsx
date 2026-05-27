import { ROLES, getRoleLabel, normalizeRoles } from '../../lib/roles';

export default function RoleBadge({ role, roles, user }) {
  const config = {
    [ROLES.CONTENT_CREATOR]: {
      label: getRoleLabel(ROLES.CONTENT_CREATOR),
      cls: 'border-mint/40 bg-mint/10 text-mint dark:text-mint',
    },
    [ROLES.BRAND_REP]: {
      label: getRoleLabel(ROLES.BRAND_REP),
      cls: 'border-purple-400/40 bg-purple-400/10 text-purple-600 dark:text-purple-200',
    },
    [ROLES.ADMIN]: {
      label: getRoleLabel(ROLES.ADMIN),
      cls: 'border-gold/40 bg-gold/10 text-gold',
    }
  };
  const resolvedRoles = normalizeRoles(user || roles || role);

  return (
    <span className="flex flex-wrap gap-1.5">
      {resolvedRoles.map(resolvedRole => {
        const { label, cls } = config[resolvedRole] || config[ROLES.CONTENT_CREATOR];

        return (
          <span key={resolvedRole} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
            {label || getRoleLabel(resolvedRole)}
          </span>
        );
      })}
    </span>
  );
}
