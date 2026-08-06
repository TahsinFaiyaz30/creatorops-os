import CreatorStatisticSnapshot from '../models/CreatorStatisticSnapshot.js';
import PlatformConnection from '../models/PlatformConnection.js';
import PublishedPost from '../models/PublishedPost.js';
import SocialMetricSnapshot from '../models/SocialMetricSnapshot.js';
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from '../constants/platforms.js';
import { getConnector } from '../platforms/connectorRegistry.js';

const metricKeys = ['likes', 'reactions', 'comments', 'shares', 'views', 'saves'];

/** Window used for every "last month" figure attached to a circular application. */
export const ANALYTICS_WINDOW_DAYS = 30;

const emptyMetrics = () => ({
  followers: null,
  subscribers: null,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  reactions: 0,
  reach: null,
  impressions: null,
  postCount: 0,
  growthPercentage: null,
  engagementRate: 0
});

const addMetrics = (target, source = {}) => {
  for (const key of metricKeys) {
    target[key] += Number(source[key] || 0);
  }
  return target;
};

const latestMetricSnapshots = async ({ workspaceId, postIds }) => {
  if (!postIds.length) return new Map();
  const snapshots = await SocialMetricSnapshot.find({
    workspaceId,
    publishedPostId: { $in: postIds }
  }).sort({ collectedAt: -1 });
  const map = new Map();
  for (const snapshot of snapshots) {
    const key = String(snapshot.publishedPostId);
    if (!map.has(key)) map.set(key, snapshot);
  }
  return map;
};

/*
 * Engagement is likes + comments + shares + saves. `reactions` is deliberately
 * excluded: on Facebook the connector writes the same total into both `likes`
 * and `reactions`, so counting both would inflate every Facebook figure.
 */
const engagementOf = metrics =>
  Number(metrics.likes || 0) + Number(metrics.comments || 0) + Number(metrics.shares || 0) + Number(metrics.saves || 0);

const computeEngagementRate = metrics => {
  const engagement = engagementOf(metrics);
  const denominator = Number(metrics.views || 0) || Number(metrics.impressions || 0) || 0;
  return denominator > 0 ? Number(((engagement / denominator) * 100).toFixed(2)) : 0;
};

export const getCreatorStatistics = async ({ user }) => {
  const [connections, posts] = await Promise.all([
    PlatformConnection.find({ workspaceId: user.workspaceId }).sort({ platform: 1, accountName: 1 }),
    PublishedPost.find({ workspaceId: user.workspaceId, status: 'published' }).sort({ publishedAt: -1 })
  ]);
  const metricMap = await latestMetricSnapshots({ workspaceId: user.workspaceId, postIds: posts.map(post => post._id) });

  const byPlatform = Object.fromEntries(
    SUPPORTED_PLATFORMS.map(platform => [
      platform,
      {
        platform,
        label: PLATFORM_LABELS[platform] || platform,
        source: 'unavailable',
        unavailableReason: 'No real synced metric snapshots for this platform yet.',
        accounts: connections
          .filter(connection => connection.platform === platform || (platform === 'youtube_shorts' && connection.platform === 'youtube'))
          .map(connection => ({
            accountName: connection.accountName,
            accountHandle: connection.accountHandle,
            status: connection.status
          })),
        metrics: emptyMetrics(),
        graph: []
      }
    ])
  );

  for (const post of posts) {
    const platform = post.platform;
    const snapshot = metricMap.get(String(post._id));
    const stats = byPlatform[platform] || byPlatform.youtube_shorts;
    if (!stats) continue;
    stats.metrics.postCount += 1;
    if (snapshot) {
      stats.source = 'real_sync';
      stats.unavailableReason = '';
      addMetrics(stats.metrics, snapshot);
      stats.graph.push({
        label: post.publishedAt || post.createdAt,
        views: snapshot.views || 0,
        engagement: (snapshot.likes || 0) + (snapshot.comments || 0) + (snapshot.shares || 0) + (snapshot.saves || 0)
      });
    }
  }

  const platformStats = Object.values(byPlatform).map(item => ({
    ...item,
    metrics: {
      ...item.metrics,
      engagementRate: computeEngagementRate(item.metrics)
    }
  }));

  const combinedStats = platformStats.reduce((acc, item) => {
    addMetrics(acc, item.metrics);
    acc.postCount += item.metrics.postCount || 0;
    return acc;
  }, emptyMetrics());
  combinedStats.engagementRate = computeEngagementRate(combinedStats);

  const activePlatforms = platformStats.filter(item => item.source === 'real_sync');
  const combinedGraph = activePlatforms.map(item => ({
    label: item.label,
    value: item.metrics.views + item.metrics.likes + item.metrics.comments + item.metrics.shares + item.metrics.saves
  }));

  return {
    source: activePlatforms.length ? 'real_sync' : 'unavailable',
    generatedAt: new Date(),
    combinedStats,
    platformStats,
    combinedGraph,
    unavailableMessage: activePlatforms.length
      ? ''
      : 'No real platform statistics are synced yet. Connect accounts, publish real posts, then sync analytics where official APIs allow it.'
  };
};

export const createCreatorStatisticSnapshot = async ({ user, source = '' }) => {
  const statistics = await getCreatorStatistics({ user });
  const snapshot = await CreatorStatisticSnapshot.create({
    workspaceId: user.workspaceId,
    creatorId: user._id,
    source: source || statistics.source,
    combinedStats: statistics.combinedStats,
    platformStats: statistics.platformStats,
    generatedAt: statistics.generatedAt
  });

  return { snapshot, statistics };
};

/* ── Applicant ranking score ───────────────────────────────────────────────────
 *
 * One number per application, used only to order a brand's applicant list. It is
 * computed once at submit time and stored, so ranking a circular's applicants is
 * an indexed read rather than a sort — and it never reaches the browser.
 *
 * Views carry the most weight, then followers and engagement equally. The raw
 * means cannot be averaged directly to achieve that: they live on different
 * scales (a creator averaging 21,000 followers, 12,300 views and 810 engagement
 * is normal), so a plain weighted sum is decided almost entirely by whichever
 * metric happens to be largest — usually followers — and the weights do nothing.
 * Compressing each metric with log1p first puts them on a comparable footing
 * (9.95 / 9.42 / 6.70 for those figures), which is what makes the weights below
 * mean what they say. log1p also maps 0 to 0, so an empty metric is not special
 * cased, and it is monotonic, so a bigger mean is always a better score.
 * ─────────────────────────────────────────────────────────────────────────── */

export const RANKING_WEIGHTS = {
  views: 0.5,
  followers: 0.25,
  engagement: 0.25
};

/**
 * @param {object} meanStatistics - a `getCreatorMeanStatistics` result, or its `mean`.
 * @returns {number} score in log space, higher is better; 0 when nothing is known.
 */
export const computeApplicantRankingScore = meanStatistics => {
  const mean = meanStatistics?.mean || meanStatistics || {};

  /*
   * A metric the provider never returned is null, and dropping it renormalises
   * the remaining weights. Treating it as 0 would rank a creator below their
   * real standing because one platform refused a field.
   */
  const components = [
    { weight: RANKING_WEIGHTS.views, value: mean.views },
    { weight: RANKING_WEIGHTS.followers, value: mean.followers },
    { weight: RANKING_WEIGHTS.engagement, value: mean.engagement }
  ].filter(component => typeof component.value === 'number' && Number.isFinite(component.value));

  if (components.length === 0) return 0;

  const weightTotal = components.reduce((total, component) => total + component.weight, 0);
  const weighted = components.reduce(
    (total, component) => total + component.weight * Math.log1p(Math.max(0, component.value)),
    0
  );

  return Number((weighted / weightTotal).toFixed(6));
};

/* ── Cross-platform coverage & means ───────────────────────────────────────────
 *
 * A brand circular names the platforms it wants. A creator qualifies only if
 * every one of those platforms is a platform they have actually published on —
 * a connected-but-never-posted account is not coverage. The figures a brand then
 * sees are averaged across exactly that required set (the "common platforms"),
 * never across the creator's other platforms, so two applicants to the same
 * circular are always compared over the same denominator.
 * ─────────────────────────────────────────────────────────────────────────── */

const platformLabel = platform => PLATFORM_LABELS[platform] || platform;

const creatorScope = creator => ({
  workspaceId: creator.workspaceId,
  createdBy: creator._id
});

/** Connections that back a given post platform (`youtube` also backs Shorts). */
const connectionPlatformsFor = platform => (platform === 'youtube_shorts' ? ['youtube'] : [platform]);

/**
 * Platforms the creator has at least one real published post on, plus the raw
 * post counts behind that answer.
 */
export const getCreatorPlatformCoverage = async ({ creator }) => {
  const rows = await PublishedPost.aggregate([
    { $match: { ...creatorScope(creator), status: 'published' } },
    { $group: { _id: '$platform', postCount: { $sum: 1 }, lastPublishedAt: { $max: '$publishedAt' } } }
  ]);

  const publishedPostCounts = {};
  for (const row of rows) {
    publishedPostCounts[row._id] = { postCount: row.postCount, lastPublishedAt: row.lastPublishedAt || null };
  }

  return {
    publishedPlatforms: Object.keys(publishedPostCounts),
    publishedPostCounts
  };
};

/**
 * Eligibility for one circular: the creator must cover every platform the
 * circular requires. Extra platforms are fine and simply do not count towards
 * the mean.
 */
export const getCircularPlatformEligibility = async ({ creator, requiredPlatforms = [] }) => {
  const required = [...new Set((requiredPlatforms || []).filter(Boolean))];
  const { publishedPlatforms, publishedPostCounts } = await getCreatorPlatformCoverage({ creator });
  const publishedSet = new Set(publishedPlatforms);

  const coveredPlatforms = required.filter(platform => publishedSet.has(platform));
  const missingPlatforms = required.filter(platform => !publishedSet.has(platform));
  const extraPlatforms = publishedPlatforms.filter(platform => !required.includes(platform));

  return {
    requiredPlatforms: required,
    /* The mean is computed over these, and only these. */
    commonPlatforms: coveredPlatforms,
    missingPlatforms,
    extraPlatforms,
    publishedPlatforms,
    publishedPostCounts,
    eligible: required.length > 0 && missingPlatforms.length === 0,
    reason:
      required.length === 0
        ? 'This circular does not name any platform, so platform coverage cannot be verified.'
        : missingPlatforms.length > 0
          ? `You have not published on ${missingPlatforms.map(platformLabel).join(', ')} yet. This circular requires ${required.map(platformLabel).join(', ')}.`
          : ''
  };
};

const readAudience = async ({ creator, platforms }) => {
  const connectionPlatforms = [...new Set(platforms.flatMap(connectionPlatformsFor))];
  const connections = await PlatformConnection.find({
    workspaceId: creator.workspaceId,
    platform: { $in: connectionPlatforms }
  });

  return platforms.reduce((acc, platform) => {
    const related = connections.filter(connection => connectionPlatformsFor(platform).includes(connection.platform));
    const withNumbers = related.filter(connection => typeof connection.audience?.followers === 'number');
    acc[platform] = {
      /* Several accounts on one platform add up; none with a number stays null. */
      followers: withNumbers.length ? withNumbers.reduce((sum, connection) => sum + connection.audience.followers, 0) : null,
      accounts: related.map(connection => ({
        accountName: connection.accountName,
        accountHandle: connection.accountHandle,
        /* Built by the connector that owns the platform's URL shape; '' when
           the provider gave nothing addressable (LinkedIn's `sub`, a TikTok
           open_id), so the UI shows a plain handle instead of a dead link. */
        profileUrl: getConnector(connection.platform)?.getAccountProfileUrl(connection) || '',
        accountType: connection.accountType,
        status: connection.status,
        followers: typeof connection.audience?.followers === 'number' ? connection.audience.followers : null,
        syncedAt: connection.audience?.syncedAt || null
      })),
      unavailableReason: withNumbers.length
        ? ''
        : related.find(connection => connection.audience?.unavailableReason)?.audience?.unavailableReason ||
          (related.length ? `${platformLabel(platform)} did not return a follower count.` : `No connected ${platformLabel(platform)} account.`)
    };
    return acc;
  }, {});
};

const mean = (total, count) => (count > 0 ? Number((total / count).toFixed(2)) : 0);

/**
 * Per-platform totals for posts published inside the window, plus the mean
 * across the given platforms. Views/likes/engagement are "on posts published in
 * the last {windowDays} days"; followers is the current account figure, which is
 * a point-in-time number and has no window.
 */
export const getCreatorMeanStatistics = async ({ creator, platforms = [], windowDays = ANALYTICS_WINDOW_DAYS }) => {
  const commonPlatforms = [...new Set((platforms || []).filter(Boolean))];
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const posts = commonPlatforms.length
    ? await PublishedPost.find({
        ...creatorScope(creator),
        status: 'published',
        platform: { $in: commonPlatforms },
        $or: [
          { publishedAt: { $gte: windowStart, $lte: windowEnd } },
          { publishedAt: null, createdAt: { $gte: windowStart, $lte: windowEnd } }
        ]
      })
        .sort({ publishedAt: 1, createdAt: 1 })
        .populate({ path: 'mediaAssetIds', select: 'mediaType originalName' })
    : [];

  const [metricMap, audienceByPlatform] = await Promise.all([
    latestMetricSnapshots({ workspaceId: creator.workspaceId, postIds: posts.map(post => post._id) }),
    commonPlatforms.length ? readAudience({ creator, platforms: commonPlatforms }) : Promise.resolve({})
  ]);

  const byPlatform = Object.fromEntries(
    commonPlatforms.map(platform => [
      platform,
      {
        platform,
        label: platformLabel(platform),
        followers: audienceByPlatform[platform]?.followers ?? null,
        followersUnavailableReason: audienceByPlatform[platform]?.unavailableReason || '',
        accounts: audienceByPlatform[platform]?.accounts || [],
        postCount: 0,
        syncedPostCount: 0,
        views: 0,
        likes: 0,
        reactions: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 0,
        engagementRate: 0
      }
    ])
  );

  const timeline = [];

  for (const post of posts) {
    const stats = byPlatform[post.platform];
    if (!stats) continue;
    stats.postCount += 1;
    const snapshot = metricMap.get(String(post._id));
    if (!snapshot) continue;

    stats.syncedPostCount += 1;
    for (const key of metricKeys) {
      stats[key] += Number(snapshot[key] || 0);
    }
    timeline.push({
      at: post.publishedAt || post.createdAt,
      platform: post.platform,
      label: platformLabel(post.platform),
      views: Number(snapshot.views || 0),
      engagement: engagementOf(snapshot)
    });
  }

  const perPlatform = Object.values(byPlatform).map(stats => ({
    ...stats,
    engagement: engagementOf(stats),
    engagementRate: computeEngagementRate(stats)
  }));

  const platformCount = perPlatform.length;
  const totals = perPlatform.reduce(
    (acc, item) => {
      acc.views += item.views;
      acc.likes += item.likes;
      acc.comments += item.comments;
      acc.shares += item.shares;
      acc.saves += item.saves;
      acc.engagement += item.engagement;
      acc.postCount += item.postCount;
      acc.syncedPostCount += item.syncedPostCount;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement: 0, postCount: 0, syncedPostCount: 0 }
  );

  /*
   * Followers averages only over the platforms that actually returned a number.
   * Dividing by the full platform count would quietly report a creator as
   * smaller than they are whenever one provider refuses the field.
   */
  const followerPlatforms = perPlatform.filter(item => typeof item.followers === 'number');
  const followersTotal = followerPlatforms.reduce((sum, item) => sum + item.followers, 0);

  const meanStats = {
    followers: followerPlatforms.length ? mean(followersTotal, followerPlatforms.length) : null,
    views: mean(totals.views, platformCount),
    likes: mean(totals.likes, platformCount),
    comments: mean(totals.comments, platformCount),
    shares: mean(totals.shares, platformCount),
    engagement: mean(totals.engagement, platformCount),
    posts: mean(totals.postCount, platformCount),
    engagementRate: computeEngagementRate(totals)
  };

  const followersUnavailablePlatforms = perPlatform
    .filter(item => typeof item.followers !== 'number')
    .map(item => ({ platform: item.platform, label: item.label, reason: item.followersUnavailableReason }));

  return {
    source: totals.syncedPostCount > 0 ? 'real_sync' : 'unavailable',
    generatedAt: new Date(),
    windowDays,
    windowStart,
    windowEnd,
    commonPlatforms,
    platformCount,
    perPlatform,
    totals,
    mean: meanStats,
    followerPlatformCount: followerPlatforms.length,
    followersUnavailablePlatforms,
    timeline,
    unavailableMessage:
      totals.postCount === 0
        ? `No posts were published on ${commonPlatforms.map(platformLabel).join(', ') || 'these platforms'} in the last ${windowDays} days, so the window totals are empty.`
        : totals.syncedPostCount === 0
          ? `${totals.postCount} post${totals.postCount === 1 ? '' : 's'} were published in the window but none has synced metrics yet. Sync analytics from Post Details to fill these numbers.`
          : ''
  };
};
