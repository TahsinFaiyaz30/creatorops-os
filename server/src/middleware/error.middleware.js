export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  if (error.code === 11000) {
    return res.status(409).json({
      message: 'A record with this unique value already exists.',
      fields: Object.keys(error.keyPattern || {})
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed.',
      errors: Object.values(error.errors).map(item => item.message)
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid resource id.',
      path: error.path
    });
  }

  return res.status(statusCode).json({
    message: error.message || 'Internal server error.'
  });
};
