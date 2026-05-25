import CreatorStatisticSnapshot from '../models/CreatorStatisticSnapshot.js';
import PlatformConnection from '../models/PlatformConnection.js';
import PublishedPost from '../models/PublishedPost.js';
import SocialMetricSnapshot from '../models/SocialMetricSnapshot.js';
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from '../constants/platforms.js';

const metricKeys = ['likes', 'reactions', 'comments', 'shares', 'views', 'saves'];

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

const computeEngagementRate = metrics => {
  const engagement = Number(metrics.likes || 0) + Number(metrics.comments || 0) + Number(metrics.shares || 0) + Number(metrics.saves || 0);
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
