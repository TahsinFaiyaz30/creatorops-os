export const CONTENT_CREATOR_ROLE = 'content_creator';
export const BRAND_REP_ROLE = 'brand_rep';
export const ADMIN_ROLE = 'admin';

export const PUBLIC_USER_ROLES = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];
export const USER_ROLES = [...PUBLIC_USER_ROLES, ADMIN_ROLE];

const unique = values => [...new Set(values)];

const toRoleArray = value => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
};

const collectValidRoles = (...sources) =>
  unique(
    sources
      .flatMap(toRoleArray)
      .filter(role => USER_ROLES.includes(role))
  );

export const normalizeRoles = (...sources) => {
  const roles = collectValidRoles(...sources);

  return roles.length > 0 ? roles : [CONTENT_CREATOR_ROLE];
};

export const primaryRole = (...sources) => {
  const roles = normalizeRoles(...sources);
  return roles.find(role => role !== ADMIN_ROLE) || roles[0] || CONTENT_CREATOR_ROLE;
};

export const normalizeRole = role => primaryRole(role);

export const resolveRoles = userOrRoles => {
  if (userOrRoles && typeof userOrRoles === 'object' && !Array.isArray(userOrRoles)) {
    return normalizeRoles(userOrRoles.roles, userOrRoles.role);
  }

  return normalizeRoles(userOrRoles);
};

export const hasRole = (userOrRoles, role) => resolveRoles(userOrRoles).includes(role);

export const isContentCreatorRole = userOrRoles => hasRole(userOrRoles, CONTENT_CREATOR_ROLE);

export const isBrandRepRole = userOrRoles => hasRole(userOrRoles, BRAND_REP_ROLE);

export const roleMatches = (actualRole, allowedRoles) => {
  const allowed = collectValidRoles(allowedRoles);
  if (allowed.length === 0) return false;

  return resolveRoles(actualRole).some(role => allowed.includes(role));
};
