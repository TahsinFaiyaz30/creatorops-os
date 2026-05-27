import BrandCircular from '../models/BrandCircular.js';
import Campaign from '../models/Campaign.js';
import CircularApplication from '../models/CircularApplication.js';
import PublishedPost from '../models/PublishedPost.js';
import PublishJob from '../models/PublishJob.js';
import WorkflowEvent from '../models/WorkflowEvent.js';
import { PLATFORM_LABELS } from '../constants/platforms.js';

const toDate = value => (value ? new Date(value) : null);

const inRange = (date, { start, end }) => {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

const matches = (event, filters) => {
  if (filters.eventType && event.eventType !== filters.eventType) return false;
  if (filters.status && event.status !== filters.status) return false;
  if (filters.platform && event.platform !== filters.platform) return false;
  if (filters.campaign && String(event.campaignId || '') !== filters.campaign) return false;
  if (filters.circular && String(event.circularId || '') !== filters.circular) return false;
  return true;
};

export const getCalendarFeed = async ({ user, query = {} }) => {
  const start = query.start ? new Date(query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = query.end ? new Date(query.end) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const filters = {
    platform: query.platform || '',
    campaign: query.campaign || '',
    circular: query.circular || '',
    eventType: query.eventType || '',
    status: query.status || ''
  };

  const [publishJobs, publishedPosts, circulars, applications, campaigns, workflowEvents] = await Promise.all([
    PublishJob.find({ workspaceId: user.workspaceId }).sort({ scheduledAt: 1 }).populate('contentItemId', 'title').limit(200),
    PublishedPost.find({ workspaceId: user.workspaceId }).sort({ publishedAt: -1 }).populate('contentItemId', 'title').limit(100),
    BrandCircular.find({ workspaceId: user.workspaceId }).sort({ deadline: 1 }).limit(100),
    CircularApplication.find({ workspaceId: user.workspaceId }).sort({ updatedAt: -1 }).populate('circularId', 'title deadline').limit(100),
    Campaign.find({ workspaceId: user.workspaceId }).sort({ updatedAt: -1 }).limit(100),
    WorkflowEvent.find({ workspaceId: user.workspaceId }).sort({ createdAt: -1 }).limit(100)
  ]);

  const events = [];

  for (const job of publishJobs) {
    const date = toDate(job.scheduledAt);
    events.push({
      id: `job-${job._id}`,
      eventType: 'scheduled_post',
      title: `${PLATFORM_LABELS[job.platform] || job.platform} scheduled post`,
      date,
      status: job.status,
      platform: job.platform,
      postGroupId: job.postGroupId || '',
      campaignId: job.campaignId,
      source: 'PublishJob',
      entityId: job._id,
      description: job.contentItemId?.title || job.caption || 'Scheduled publish job'
    });
  }

  for (const post of publishedPosts) {
    const date = toDate(post.publishedAt || post.createdAt);
    events.push({
      id: `post-${post._id}`,
      eventType: 'published_post',
      title: `${PLATFORM_LABELS[post.platform] || post.platform} published post`,
      date,
      status: post.status,
      platform: post.platform,
      postGroupId: post.postGroupId || '',
      campaignId: post.campaignId,
      source: 'PublishedPost',
      entityId: post._id,
      description: post.contentItemId?.title || post.caption || 'Published post'
    });
  }

  for (const circular of circulars) {
    events.push({
      id: `circular-${circular._id}`,
      eventType: 'circular_deadline',
      title: `Circular deadline: ${circular.title}`,
      date: circular.deadline,
      status: circular.status,
      circularId: circular._id,
      source: 'BrandCircular',
      entityId: circular._id,
      description: circular.productName
    });
  }

  for (const application of applications) {
    events.push({
      id: `application-${application._id}`,
      eventType: 'application_deadline',
      title: `Application ${application.status}: ${application.circularId?.title || 'Circular'}`,
      date: application.updatedAt,
      status: application.status,
      circularId: application.circularId?._id,
      source: 'CircularApplication',
      entityId: application._id,
      description: application.reviewComment || application.message || ''
    });
  }

  for (const campaign of campaigns) {
    events.push({
      id: `campaign-${campaign._id}`,
      eventType: 'upcoming_event',
      title: `Campaign milestone: ${campaign.name}`,
      date: campaign.updatedAt,
      status: campaign.status,
      campaignId: campaign._id,
      source: 'Campaign',
      entityId: campaign._id,
      description: campaign.goal || ''
    });
  }

  for (const event of workflowEvents) {
    events.push({
      id: `workflow-${event._id}`,
      eventType: 'workflow_milestone',
      title: event.eventType,
      date: event.createdAt,
      status: '',
      source: 'WorkflowEvent',
      entityId: event._id,
      description: event.message || ''
    });
  }

  const filtered = events
    .filter(event => inRange(event.date, { start, end }))
    .filter(event => matches(event, filters))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    start,
    end,
    filters,
    events: filtered,
    recentActivity: filtered
      .filter(event => ['published_post', 'workflow_milestone'].includes(event.eventType))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
  };
};
