export const CONTENT_CREATOR_ROLE = 'content_creator';
export const BRAND_REP_ROLE = 'brand_rep';

export const PUBLIC_USER_ROLES = [CONTENT_CREATOR_ROLE, BRAND_REP_ROLE];
export const LEGACY_USER_ROLES = ['editor', 'creator_admin'];
export const USER_ROLES = [...PUBLIC_USER_ROLES, ...LEGACY_USER_ROLES];

const ROLE_ALIASES = {
  editor: CONTENT_CREATOR_ROLE,
  creator_admin: CONTENT_CREATOR_ROLE,
  content_creator: CONTENT_CREATOR_ROLE,
  brand_rep: BRAND_REP_ROLE
};

export const normalizeRole = role => ROLE_ALIASES[role] || role || CONTENT_CREATOR_ROLE;

export const isContentCreatorRole = role => normalizeRole(role) === CONTENT_CREATOR_ROLE;

export const isBrandRepRole = role => normalizeRole(role) === BRAND_REP_ROLE;

export const roleMatches = (actualRole, allowedRoles) => {
  const normalizedActual = normalizeRole(actualRole);
  return allowedRoles.map(normalizeRole).includes(normalizedActual);
};
