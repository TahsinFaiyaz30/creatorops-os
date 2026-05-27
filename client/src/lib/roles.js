export const ROLES = {
  CONTENT_CREATOR: 'content_creator',
  BRAND_REP: 'brand_rep',
  ADMIN: 'admin'
};

const USER_ROLES = Object.values(ROLES);
export const PUBLIC_ROLES = [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP];

const ROLE_LABELS = {
  [ROLES.CONTENT_CREATOR]: 'Content Creator',
  [ROLES.BRAND_REP]: 'Brand Representative',
  [ROLES.ADMIN]: 'Admin'
};

const unique = values => [...new Set(values)];

const toRoleArray = value => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
};

export const normalizeRoles = (...sources) => {
  const roles = unique(
    sources
      .flatMap(source => {
        if (source && typeof source === 'object' && !Array.isArray(source)) {
          return toRoleArray(source.roles).concat(toRoleArray(source.role));
        }

        return toRoleArray(source);
      })
      .filter(role => USER_ROLES.includes(role))
  );

  return roles.length > 0 ? roles : [ROLES.CONTENT_CREATOR];
};

export const primaryRole = (...sources) => {
  const roles = normalizeRoles(...sources);
  return roles.find(role => role !== ROLES.ADMIN) || roles[0] || ROLES.CONTENT_CREATOR;
};

export const normalizeRole = role => primaryRole(role);

export const hasRole = (userOrRoles, role) => normalizeRoles(userOrRoles).includes(role);

export const getRoleLabel = role => ROLE_LABELS[role] || ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS[ROLES.CONTENT_CREATOR];

export const getRoleLabels = userOrRoles => normalizeRoles(userOrRoles).map(getRoleLabel);

export const isContentCreator = userOrRoles => hasRole(userOrRoles, ROLES.CONTENT_CREATOR);

export const isBrandRep = userOrRoles => hasRole(userOrRoles, ROLES.BRAND_REP);

export const hasAdminRole = userOrRoles => hasRole(userOrRoles, ROLES.ADMIN);

export const canUseCreatorTools = userOrRoles => isContentCreator(userOrRoles);

export const canPublish = userOrRoles => isContentCreator(userOrRoles) || isBrandRep(userOrRoles);

export const canManageAccounts = userOrRoles => canPublish(userOrRoles);

export const canEngageWithSocial = userOrRoles => canPublish(userOrRoles);

export const homePathForUser = userOrRoles => {
  if (isContentCreator(userOrRoles) || isBrandRep(userOrRoles)) return '/dashboard';
  if (hasAdminRole(userOrRoles)) return '/admin';
  return '/dashboard';
};
