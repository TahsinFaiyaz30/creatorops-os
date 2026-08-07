/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Public statistics — what the signup page shows before anyone has an account.
 *
 * The signup panel used to render invented numbers: a fixed calendar week, a
 * progress bar animating on a loop, and a feed of seven hardcoded strings. This
 * replaces all of it with counts read from the same collections the product
 * writes to.
 *
 * Two rules govern everything in this file, because the endpoint is
 * unauthenticated and anyone on the internet can read it:
 *
 *   1. Counts only. No names, emails, workspace titles, campaign titles,
 *      captions or ids ever leave this module. The activity feed is built from
 *      `eventType` alone — `WorkflowEvent.message` contains real names, so it
 *      is never read.
 *   2. Nothing is invented. If a collection is empty the number is 0 and the
 *      page says so, rather than falling back to a flattering default.
 *
 * The result is cached briefly: this is the first request an anonymous visitor
 * makes, it is identical for all of them, and six aggregations per page view
 * would be a free denial-of-service vector.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';

import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import PublishedPost from '../models/PublishedPost.js';
import PublishJob from '../models/PublishJob.js';
import PlatformConnection from '../models/PlatformConnection.js';
import WorkflowEvent from '../models/WorkflowEvent.js';
import Campaign from '../models/Campaign.js';
import { BRAND_REP_ROLE, CONTENT_CREATOR_ROLE } from '../constants/roles.js';

const CACHE_TTL_MS = 30_000;

let cache = { at: 0, payload: null };

/*
 * Event type → a phrase that names the stage without naming the person, the
 * workspace or the content. Anything not in this map is dropped rather than
 * shown with its raw type, so a new event added elsewhere in the app cannot
 * start leaking through this endpoint by default.
 */
const PUBLIC_EVENT_LABELS = {
  'publish.succeeded': 'Published to a live platform',
  'publish.queued': 'Post queued for publishing',
  'publish.started': 'Publish started',
  'publish.retried': 'Publish retried',
  'approval.requested': 'Review requested',
  'approval.approved': 'Variant approved',
  'approval.changes_requested': 'Changes requested on a draft',
  'ai.variants_generated': 'AI generated platform variants',
  'ai.variant_optimized': 'Variant optimised for a platform',
  'campaign.created': 'New campaign created',
  'content.created': 'New idea captured',
  'deliverable.submitted': 'Deliverable submitted for review',
  'handoff.sent': 'Work handed to a teammate',
  'application.submitted': 'Creator applied to a brand circular',
  'circular.created': 'Brand posted a circular',
  'script.converted_to_content': 'Script turned into content'
};

const connected = () => mongoose.connection?.readyState === 1;

/** Counts of published posts per platform, biggest first. */
const platformBreakdown = async () => {
  const rows = await PublishedPost.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$platform', posts: { $sum: 1 } } },
    { $sort: { posts: -1 } },
    { $limit: 6 }
  ]);
  return rows.filter(row => row._id).map(row => ({ platform: row._id, posts: row.posts }));
};

/**
 * Recent activity, stripped to a stage name and a timestamp.
 *
 * Over-fetched then filtered: the map above is a whitelist, so a page of raw
 * events can reduce to nothing publishable and we still want a full feed.
 */
const recentActivity = async (limit = 7) => {
  const events = await WorkflowEvent.find({ eventType: { $in: Object.keys(PUBLIC_EVENT_LABELS) } })
    .sort({ createdAt: -1 })
    .limit(limit * 3)
    .select('eventType createdAt')
    .lean();

  return events
    .slice(0, limit)
    .map(event => ({ label: PUBLIC_EVENT_LABELS[event.eventType], at: event.createdAt }));
};

export const getPublicStats = async ({ force = false } = {}) => {
  if (!force && cache.payload && Date.now() - cache.at < CACHE_TTL_MS) return cache.payload;

  /*
   * Without a database the endpoint answers with zeroes and says it is
   * unavailable, rather than 500ing the signup page into a blank panel.
   */
  if (!connected()) {
    return {
      available: false,
      creators: 0,
      brands: 0,
      workspaces: 0,
      campaigns: 0,
      publishedPosts: 0,
      publishingNow: 0,
      connectedAccounts: 0,
      platforms: [],
      recent: [],
      generatedAt: new Date()
    };
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    creators,
    brands,
    workspaces,
    campaigns,
    publishedPosts,
    publishedToday,
    publishingNow,
    connectedAccounts,
    platforms,
    recent
  ] = await Promise.all([
    User.countDocuments({ roles: CONTENT_CREATOR_ROLE }),
    User.countDocuments({ roles: BRAND_REP_ROLE }),
    Workspace.countDocuments({}),
    Campaign.countDocuments({}),
    PublishedPost.countDocuments({ status: 'published' }),
    PublishedPost.countDocuments({ status: 'published', publishedAt: { $gte: dayAgo } }),
    PublishJob.countDocuments({ status: { $in: ['queued', 'publishing'] } }),
    PlatformConnection.countDocuments({ status: 'connected' }),
    platformBreakdown(),
    recentActivity()
  ]);

  const payload = {
    available: true,
    creators,
    brands,
    workspaces,
    campaigns,
    publishedPosts,
    publishedToday,
    publishingNow,
    connectedAccounts,
    platforms,
    recent,
    generatedAt: new Date()
  };

  cache = { at: Date.now(), payload };
  return payload;
};

/** Test seam — the cache would otherwise outlive a fixture change. */
export const clearPublicStatsCache = () => {
  cache = { at: 0, payload: null };
};
