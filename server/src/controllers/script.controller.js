import {
  convertScriptToContent,
  getScriptConversation,
  listScriptConversations,
  sendScriptMessage
} from '../services/script.service.js';

export const aiScript = async (req, res, next) => {
  try {
    const result = await sendScriptMessage({ user: req.user, input: req.body });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getScripts = async (req, res, next) => {
  try {
    const conversations = await listScriptConversations({ user: req.user });
    res.json({ data: { conversations } });
  } catch (error) {
    next(error);
  }
};

export const getScript = async (req, res, next) => {
  try {
    const conversation = await getScriptConversation({ user: req.user, conversationId: req.params.id });
    res.json({ data: { conversation } });
  } catch (error) {
    next(error);
  }
};

export const convertScript = async (req, res, next) => {
  try {
    const result = await convertScriptToContent({
      user: req.user,
      conversationId: req.params.id,
      campaignId: req.body.campaignId
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};
