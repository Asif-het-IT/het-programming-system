export function notFoundHandler(_req, _res, next) {
  next({ status: 404, message: 'Route not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const payload = {
    error: err.message || 'Internal server error',
  };

  if (err.details) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}
