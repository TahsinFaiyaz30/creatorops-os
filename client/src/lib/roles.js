export const ROLES = {
  CONTENT_CREATOR: 'content_creator',
  BRAND_REP: 'brand_rep'
};

const ROLE_ALIASES = {
  editor: ROLES.CONTENT_CREATOR,
  creator_admin: ROLES.CONTENT_CREATOR,
  content_creator: ROLES.CONTENT_CREATOR,
  brand_rep: ROLES.BRAND_REP
};

const ROLE_LABELS = {
  [ROLES.CONTENT_CREATOR]: 'Content Creator',
  [ROLES.BRAND_REP]: 'Brand Representative'
};

export const normalizeRole = role => ROLE_ALIASES[role] || role || ROLES.CONTENT_CREATOR;

export const getRoleLabel = role => ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS[ROLES.CONTENT_CREATOR];

export const isContentCreator = role => normalizeRole(role) === ROLES.CONTENT_CREATOR;

export const isBrandRep = role => normalizeRole(role) === ROLES.BRAND_REP;

export const canUseCreatorTools = role => isContentCreator(role);

export const canPublish = role => [ROLES.CONTENT_CREATOR, ROLES.BRAND_REP].includes(normalizeRole(role));
