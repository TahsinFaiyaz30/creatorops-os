/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Backfill: give every pre-existing workspace its positions and its owner
 * membership.
 *
 * Before teams, a workspace was implicitly a single user's private space and no
 * membership row existed. Team permission checks read those rows, so without
 * this every existing account would lose access to its own data the moment the
 * permission middleware went live.
 *
 * Idempotent — safe to run repeatedly, and safe to run against a live database.
 *
 *   npm run backfill:teams   (from /server)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import mongoose from 'mongoose';

import env from '../config/env.js';
import TeamMembership from '../models/TeamMembership.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { ensureOwnerMembership, ensureTeamRoles, syncWorkspaceTeamMode } from '../services/teamMembership.service.js';

/**
 * Repairs only what is actually missing, then returns.
 *
 * Called on every boot because the deployment target (Render Free) has no shell
 * and no pre-deploy hook, so there is nowhere to run the migration by hand. It
 * has to be cheap on the boots where there is nothing to do: one indexed count,
 * and it returns immediately.
 *
 * Nothing here is load-bearing for existing accounts — `resolveTeamContext`
 * short-circuits for a workspace owner, so a solo creator keeps full access even
 * with no membership row. This just makes the state explicit rather than implied.
 */
export const backfillTeamsIfNeeded = async ({ log = console.log } = {}) => {
  /*
   * Ask the only question that matters: is there a workspace whose OWNER has no
   * membership row? Comparing collection counts cannot answer it — a four-person
   * team has four memberships against one workspace, so totals stay ahead even
   * when a workspace is missing its owner entirely.
   */
  const pending = await Workspace.aggregate([
    {
      $lookup: {
        from: TeamMembership.collection.name,
        let: { workspaceId: '$_id', ownerId: '$ownerId' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ['$workspaceId', '$$workspaceId'] }, { $eq: ['$userId', '$$ownerId'] }] }
            }
          },
          { $limit: 1 }
        ],
        as: 'ownerMembership'
      }
    },
    { $match: { ownerMembership: { $size: 0 } } },
    { $limit: 1 }
  ]);

  if (pending.length === 0) return null;

  log('[teams] found workspaces without an owner membership — backfilling...');
  const stats = await backfillTeams({ log });
  log(
    `[teams] backfill done. workspaces=${stats.workspaces} memberships_created=${stats.membershipsCreated} ` +
      `orphan_workspaces=${stats.orphanWorkspaces}`
  );
  return stats;
};

export const backfillTeams = async ({ log = console.log } = {}) => {
  const workspaces = await Workspace.find({});
  const stats = { workspaces: 0, rolesSeeded: 0, membershipsCreated: 0, orphanWorkspaces: 0, repaired: 0 };

  for (const workspace of workspaces) {
    stats.workspaces += 1;

    /*
     * A workspace whose owner no longer exists cannot be given a membership.
     * Recorded and skipped rather than crashing the whole backfill.
     */
    const owner = workspace.ownerId ? await User.findById(workspace.ownerId).select('_id') : null;
    if (!owner) {
      stats.orphanWorkspaces += 1;
      log(`  ! workspace ${workspace._id} ("${workspace.name}") has no owner account — skipped`);
      continue;
    }

    const rolesBefore = await ensureTeamRoles({ workspaceId: workspace._id, createdBy: owner._id });
    stats.rolesSeeded += rolesBefore.length;

    const existing = await TeamMembership.findOne({ workspaceId: workspace._id, userId: owner._id });
    await ensureOwnerMembership({ workspaceId: workspace._id, ownerId: owner._id });
    if (existing) {
      stats.repaired += 1;
    } else {
      stats.membershipsCreated += 1;
    }

    await syncWorkspaceTeamMode(workspace._id);
  }

  return stats;
};

const isDirectRun = process.argv[1] && process.argv[1].endsWith('backfillTeams.js');

if (isDirectRun) {
  (async () => {
    await mongoose.connect(env.mongoUri);
    console.log('Backfilling team memberships...');
    const stats = await backfillTeams();
    console.log(
      `Done. workspaces=${stats.workspaces} memberships_created=${stats.membershipsCreated} ` +
        `already_present=${stats.repaired} orphan_workspaces=${stats.orphanWorkspaces}`
    );
    await mongoose.disconnect();
    process.exit(0);
  })().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export default backfillTeams;
