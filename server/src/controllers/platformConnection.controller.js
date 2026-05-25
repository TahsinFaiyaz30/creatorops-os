import {
  deleteConnection,
  disconnectConnection,
  getConnectionCapabilities,
  getConnectionStatus,
  getPlatformConnectionById,
  healthCheckConnection,
  listPlatformConnections,
  refreshConnection,
  sanitizeConnection
} from '../services/platformConnection.service.js';

export const listConnections = async (req, res, next) => {
  try {
    const connections = await listPlatformConnections({ user: req.user, query: req.query });
    res.json({ data: { connections } });
  } catch (error) {
    next(error);
  }
};

export const getConnection = async (req, res, next) => {
  try {
    const connection = await getPlatformConnectionById({ user: req.user, connectionId: req.params.id });
    res.json({ data: { connection: sanitizeConnection(connection) } });
  } catch (error) {
    next(error);
  }
};

export const getStatus = async (req, res, next) => {
  try {
    const platforms = await getConnectionStatus({ user: req.user });
    res.json({ data: { platforms } });
  } catch (error) {
    next(error);
  }
};

export const getCapabilities = async (_req, res, next) => {
  try {
    const platforms = await getConnectionCapabilities();
    res.json({ data: { platforms } });
  } catch (error) {
    next(error);
  }
};

export const disconnect = async (req, res, next) => {
  try {
    const connection = await disconnectConnection({ user: req.user, connectionId: req.params.id });
    res.json({ data: { connection } });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const connection = await refreshConnection({ user: req.user, connectionId: req.params.id });
    res.json({ data: { connection } });
  } catch (error) {
    next(error);
  }
};

export const healthCheck = async (req, res, next) => {
  try {
    const result = await healthCheckConnection({ user: req.user, connectionId: req.params.id });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const connection = await deleteConnection({ user: req.user, connectionId: req.params.id });
    res.json({ data: { connection } });
  } catch (error) {
    next(error);
  }
};
