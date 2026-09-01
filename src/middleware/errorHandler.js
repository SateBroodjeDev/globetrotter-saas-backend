const STATUS_CODE_TO_ERROR_CODE = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_SERVER_ERROR'
};

const formatError = (message, code = 'INTERNAL_SERVER_ERROR', details) => ({
  error: {
    message,
    code,
    ...(details !== undefined ? { details } : {})
  }
});

const createError = (statusCode, message, code, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || STATUS_CODE_TO_ERROR_CODE[statusCode] || 'INTERNAL_SERVER_ERROR';
  error.details = details;
  return error;
};

const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const response = formatError(
    message,
    err.code || STATUS_CODE_TO_ERROR_CODE[statusCode] || 'INTERNAL_SERVER_ERROR',
    err.details
  );

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler, createError, formatError };
