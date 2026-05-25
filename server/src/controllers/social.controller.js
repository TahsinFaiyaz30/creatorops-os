import {
  getAnalyticsSummary,
  getPublishedPost,
  getUnifiedPostGroup,
  listComments,
  listMetrics,
  listPublishedPosts,
  listUnifiedPostGroups,
  replyToSocialComment,
  syncPublishedPost,
  syncUnifiedPostGroup
} from '../services/social.service.js';

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

export const analyticsSummary = async (req, res, next) => {
  try {
    const summary = await getAnalyticsSummary({ user: req.user });
    res.json({ data: { summary } });
  } catch (error) {
    next(error);
  }
};
