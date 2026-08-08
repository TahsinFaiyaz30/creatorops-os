import {
  getAnalyticsSummary,
  getPublishedPost,
  getUnifiedPostGroup,
  listComments,
  listMetrics,
  listPublishedPosts,
  listUnifiedPostGroups,
  replyToSocialComment,
  replyToSocialReply,
  syncPublishedPost,
  syncUnifiedPostGroup
} from '../services/social.service.js';
import {
  getMediaAssetPosts,
  getPostGroupMedia,
  getPostMedia,
  getPostThumbnails
} from '../services/postMedia.service.js';

export const getPosts = async (req, res, next) => {
  try {
    const posts = await listPublishedPosts({ user: req.user });
    res.json({ data: { posts } });
  } catch (error) {
    next(error);
  }
};

export const getPostGroups = async (req, res, next) => {
  try {
    const groups = await listUnifiedPostGroups({ user: req.user });
    res.json({ data: { groups } });
  } catch (error) {
    next(error);
  }
};

export const getPostGroup = async (req, res, next) => {
  try {
    const group = await getUnifiedPostGroup({
      user: req.user,
      groupId: req.params.id,
      platform: req.query.platform || ''
    });
    res.json({ data: { group } });
  } catch (error) {
    next(error);
  }
};

export const syncPostGroup = async (req, res, next) => {
  try {
    const result = await syncUnifiedPostGroup({ user: req.user, groupId: req.params.id });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getPost = async (req, res, next) => {
  try {
    const post = await getPublishedPost({ user: req.user, postId: req.params.id });
    res.json({ data: { post } });
  } catch (error) {
    next(error);
  }
};

export const syncPost = async (req, res, next) => {
  try {
    const result = await syncPublishedPost({ user: req.user, postId: req.params.id });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getMetrics = async (req, res, next) => {
  try {
    const metrics = await listMetrics({ user: req.user, postId: req.params.id });
    res.json({ data: { metrics } });
  } catch (error) {
    next(error);
  }
};

export const getComments = async (req, res, next) => {
  try {
    const comments = await listComments({ user: req.user, postId: req.params.id });
    res.json({ data: { comments } });
  } catch (error) {
    next(error);
  }
};

export const replyToComment = async (req, res, next) => {
  try {
    const reply = await replyToSocialComment({
      user: req.user,
      commentId: req.params.id,
      replyText: req.body.replyText
    });
    res.status(201).json({ data: { reply } });
  } catch (error) {
    next(error);
  }
};

export const replyToReply = async (req, res, next) => {
  try {
    const reply = await replyToSocialReply({
      user: req.user,
      replyId: req.params.id,
      replyText: req.body.replyText
    });
    res.status(201).json({ data: { reply } });
  } catch (error) {
    next(error);
  }
};

export const analyticsSummary = async (req, res, next) => {
  try {
    const summary = await getAnalyticsSummary({ user: req.user });
    res.json({ data: { summary } });
  } catch (error) {
    next(error);
  }
};

/*
 * Media borrowed back from the platforms. See postMedia.service.js — nothing
 * these three return is stored anywhere.
 */

export const postMedia = async (req, res, next) => {
  try {
    const media = await getPostMedia({ user: req.user, postId: req.params.id });
    res.json({ data: { media } });
  } catch (error) {
    next(error);
  }
};

export const postGroupMedia = async (req, res, next) => {
  try {
    const media = await getPostGroupMedia({ user: req.user, groupId: req.params.id });
    res.json({ data: { media } });
  } catch (error) {
    next(error);
  }
};

export const postThumbnails = async (req, res, next) => {
  try {
    /* POST, not GET: a page of ids is too long for a query string once a feed
       has more than a handful of posts on it. */
    const result = await getPostThumbnails({ user: req.user, postIds: req.body?.postIds || [] });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const mediaAssetPosts = async (req, res, next) => {
  try {
    const media = await getMediaAssetPosts({ user: req.user, mediaAssetId: req.params.id });
    res.json({ data: { media } });
  } catch (error) {
    next(error);
  }
};
