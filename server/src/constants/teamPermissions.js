/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Team permissions.
 *
 * Two independent authorisation layers exist, and conflating them is the mistake
 * this file avoids:
 *
 *   · Platform role (content_creator / brand_rep / admin) — what the ACCOUNT is.
 *     Unchanged, still enforced by requireRole.
 *   · Team permission — what you may do INSIDE one particular team.
 *
 * Every permission below gates code that already exists, so none of them is
 * aspirational. A permission with nothing behind it is a lie told to whoever
 * reads the role editor.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TEAM_PERMISSIONS = {
  TEAM_MANAGE: 'team.manage',
  TEAM_INVITE: 'team.invite',
  TEAM_REMOVE: 'team.remove',
  TEAM_ROLES: 'team.roles',

  PROJECT_CREATE: 'project.create',
  PROJECT_MANAGE: 'project.manage',
  /* Without this you see only the projects you are assigned to. */
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
  /* Without this the media library shows only assets from your own projects. */
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

export const ALL_TEAM_PERMISSIONS = Object.values(TEAM_PERMISSIONS);

/** Grouped for the role editor, so the UI never has to hardcode this list. */
export const TEAM_PERMISSION_GROUPS = [
  {
    key: 'team',
    label: 'Team',
    permissions: [
      { key: TEAM_PERMISSIONS.TEAM_MANAGE, label: 'Manage team settings' },
      { key: TEAM_PERMISSIONS.TEAM_INVITE, label: 'Hire and invite members' },
      { key: TEAM_PERMISSIONS.TEAM_REMOVE, label: 'Remove members' },
      { key: TEAM_PERMISSIONS.TEAM_ROLES, label: 'Create and edit positions' }
    ]
  },
  {
    key: 'projects',
    label: 'Projects',
    permissions: [
      { key: TEAM_PERMISSIONS.PROJECT_CREATE, label: 'Create projects' },
      { key: TEAM_PERMISSIONS.PROJECT_MANAGE, label: 'Edit and archive any project' },
      { key: TEAM_PERMISSIONS.PROJECT_VIEW_ALL, label: 'See every project, not only assigned ones' },
      { key: TEAM_PERMISSIONS.PROJECT_ASSIGN, label: 'Assign tasks to members' }
    ]
  },
  {
    key: 'content',
    label: 'Content',
    permissions: [
      { key: TEAM_PERMISSIONS.CONTENT_CREATE, label: 'Create tasks and ideas' },
      { key: TEAM_PERMISSIONS.CONTENT_EDIT, label: 'Edit tasks' },
      { key: TEAM_PERMISSIONS.CONTENT_DELETE, label: 'Delete tasks' },
      { key: TEAM_PERMISSIONS.VARIANT_GENERATE, label: 'Generate platform variants' },
      { key: TEAM_PERMISSIONS.VARIANT_EDIT, label: 'Edit captions and variants' },
      { key: TEAM_PERMISSIONS.SCRIPT_USE, label: 'Use Script AI' }
    ]
  },
  {
    key: 'media',
    label: 'Media',
    permissions: [
      { key: TEAM_PERMISSIONS.MEDIA_UPLOAD, label: 'Upload media' },
      { key: TEAM_PERMISSIONS.MEDIA_DELETE, label: 'Delete media' },
      { key: TEAM_PERMISSIONS.MEDIA_VIEW_ALL, label: 'See the whole team media library' }
    ]
  },
  {
    key: 'review',
    label: 'Review',
    permissions: [
      { key: TEAM_PERMISSIONS.APPROVAL_REQUEST, label: 'Submit work for approval' },
      { key: TEAM_PERMISSIONS.APPROVAL_DECIDE, label: 'Approve, reject or request changes' }
    ]
  },
  {
    key: 'publish',
    label: 'Publish',
    permissions: [
      { key: TEAM_PERMISSIONS.PUBLISH_SCHEDULE, label: 'Queue and schedule posts' },
      { key: TEAM_PERMISSIONS.PUBLISH_DISPATCH, label: 'Push posts live' },
      { key: TEAM_PERMISSIONS.ACCOUNTS_MANAGE, label: 'Connect and disconnect platform accounts' }
    ]
  },
  {
    key: 'measure',
    label: 'Measure',
    permissions: [
      { key: TEAM_PERMISSIONS.ANALYTICS_VIEW, label: 'View analytics and published posts' },
      { key: TEAM_PERMISSIONS.INBOX_REPLY, label: 'Reply to comments as the account' },
      { key: TEAM_PERMISSIONS.MARKETPLACE_APPLY, label: 'Apply to brand circulars for the team' }
    ]
  }
];

/**
 * Positions seeded into every new team. All are editable and cloneable — a head
 * can build any position from scratch; these only save them the first ten minutes.
 * Owner is the exception: immutable, holds everything, exactly one per team.
 */
export const SYSTEM_TEAM_ROLES = [
  {
    name: 'Owner',
    color: '#8b5cf6',
    description: 'Full control of the team. Cannot be edited or removed.',
    isOwner: true,
    rank: 0,
    permissions: ALL_TEAM_PERMISSIONS
  },
  {
    name: 'Manager',
    color: '#0ea5e9',
    description: 'Runs projects and reviews work, but cannot change positions or platform accounts.',
    rank: 10,
    permissions: ALL_TEAM_PERMISSIONS.filter(
      permission =>
        ![
          TEAM_PERMISSIONS.TEAM_ROLES,
          TEAM_PERMISSIONS.ACCOUNTS_MANAGE,
          TEAM_PERMISSIONS.MARKETPLACE_APPLY,
          TEAM_PERMISSIONS.TEAM_MANAGE
        ].includes(permission)
    )
  },
  {
    name: 'Editor',
    color: '#22c55e',
    description: 'Writes and edits content, submits work for approval.',
    rank: 20,
    permissions: [
      TEAM_PERMISSIONS.CONTENT_CREATE,
      TEAM_PERMISSIONS.CONTENT_EDIT,
      TEAM_PERMISSIONS.VARIANT_GENERATE,
      TEAM_PERMISSIONS.VARIANT_EDIT,
      TEAM_PERMISSIONS.MEDIA_UPLOAD,
      TEAM_PERMISSIONS.APPROVAL_REQUEST,
      TEAM_PERMISSIONS.ANALYTICS_VIEW
    ]
  },
  {
    name: 'Designer',
    color: '#f59e0b',
    description: 'Produces media and hands it to the team.',
    rank: 30,
    permissions: [
      TEAM_PERMISSIONS.MEDIA_UPLOAD,
      TEAM_PERMISSIONS.CONTENT_EDIT,
      TEAM_PERMISSIONS.APPROVAL_REQUEST
    ]
  },
  {
    name: 'Scriptwriter',
    color: '#ec4899',
    description: 'Writes scripts and hooks with Script AI.',
    rank: 40,
    permissions: [
      TEAM_PERMISSIONS.SCRIPT_USE,
      TEAM_PERMISSIONS.CONTENT_CREATE,
      TEAM_PERMISSIONS.CONTENT_EDIT,
      TEAM_PERMISSIONS.APPROVAL_REQUEST
    ]
  },
  {
    name: 'Publisher',
    color: '#14b8a6',
    description: 'Schedules and dispatches approved posts. Still cannot publish without a release.',
    rank: 50,
    permissions: [
      TEAM_PERMISSIONS.PUBLISH_SCHEDULE,
      TEAM_PERMISSIONS.PUBLISH_DISPATCH,
      TEAM_PERMISSIONS.APPROVAL_REQUEST,
      TEAM_PERMISSIONS.ANALYTICS_VIEW
    ]
  },
  {
    name: 'Analyst',
    color: '#64748b',
    description: 'Reads analytics and published posts. Changes nothing.',
    rank: 60,
    permissions: [TEAM_PERMISSIONS.ANALYTICS_VIEW]
  },
  {
    name: 'Viewer',
    color: '#94a3b8',
    description: 'Read-only, and only on assigned projects.',
    rank: 70,
    permissions: []
  }
];

export const normalizeTeamPermissions = permissions =>
  [...new Set((Array.isArray(permissions) ? permissions : []).filter(permission => ALL_TEAM_PERMISSIONS.includes(permission)))];

export const hasTeamPermission = (granted, permission) =>
  Array.isArray(granted) && granted.includes(permission);
