/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Active workspace.
 *
 * A team is a workspace, and every API request carries which one it is acting in
 * through the X-Workspace-Id header. Stored rather than held in React state so a
 * full page load lands in the same team the user left off in, and read straight
 * from storage by `api` so no call site has to remember to pass it.
 *
 * Empty means "my personal workspace", which is what the server falls back to.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ACTIVE_WORKSPACE_KEY = 'creatorops.activeWorkspace';
const ACTIVE_TEAM_KEY = 'creatorops.activeTeam';

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
};

const emitChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('creatorops:workspace-changed'));
};

export const getActiveWorkspaceId = () => getStorage()?.getItem(ACTIVE_WORKSPACE_KEY) || '';

/** The cached team row, so the shell can render a name before /api/teams returns. */
export const getActiveTeam = () => {
  const raw = getStorage()?.getItem(ACTIVE_TEAM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

export const setActiveWorkspace = team => {
  const storage = getStorage();
  if (!storage) return;

  if (!team || team.isPersonal) {
    storage.removeItem(ACTIVE_WORKSPACE_KEY);
    storage.removeItem(ACTIVE_TEAM_KEY);
  } else {
    storage.setItem(ACTIVE_WORKSPACE_KEY, String(team._id));
    storage.setItem(ACTIVE_TEAM_KEY, JSON.stringify(team));
  }
  emitChange();
};

export const clearActiveWorkspace = () => setActiveWorkspace(null);

export const onWorkspaceChange = handler => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('creatorops:workspace-changed', handler);
  return () => window.removeEventListener('creatorops:workspace-changed', handler);
};

/* ── Permissions ──────────────────────────────────────────────────────────── */

export const TEAM_PERMISSIONS = {
  TEAM_MANAGE: 'team.manage',
  TEAM_INVITE: 'team.invite',
  TEAM_REMOVE: 'team.remove',
  TEAM_ROLES: 'team.roles',
  PROJECT_CREATE: 'project.create',
  PROJECT_MANAGE: 'project.manage',
  PROJECT_VIEW_ALL: 'project.view_all',
  PROJECT_ASSIGN: 'project.assign',
  CONTENT_CREATE: 'content.create',
  CONTENT_EDIT: 'content.edit',
  CONTENT_DELETE: 'content.delete',
  VARIANT_GENERATE: 'variant.generate',
  VARIANT_EDIT: 'variant.edit',
  SCRIPT_USE: 'script.use',
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',
  MEDIA_VIEW_ALL: 'media.view_all',
  APPROVAL_REQUEST: 'approval.request',
  APPROVAL_DECIDE: 'approval.decide',
  PUBLISH_SCHEDULE: 'publish.schedule',
  PUBLISH_DISPATCH: 'publish.dispatch',
  ACCOUNTS_MANAGE: 'accounts.manage',
  ANALYTICS_VIEW: 'analytics.view',
  INBOX_REPLY: 'inbox.reply',
  MARKETPLACE_APPLY: 'marketplace.apply'
};

/**
 * A creator in their own workspace holds everything, so an unknown permission
 * list is treated as "personal workspace, allow" rather than "deny". Denying by
 * default here would black out the solo experience on a slow first paint; the
 * server is the authority either way.
 */
export const canInTeam = (team, permission) => {
  if (!team) return true;
  if (team.isOwner || team.isPersonal) return true;
  return Array.isArray(team.permissions) ? team.permissions.includes(permission) : true;
};
