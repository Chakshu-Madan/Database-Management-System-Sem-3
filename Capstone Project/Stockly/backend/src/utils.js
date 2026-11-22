// Small helpers shared by all route files.

// An error that carries an HTTP status code (400 = bad input, 404 = not found ...)
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express doesn't catch errors thrown inside async functions by itself.
// This wrapper forwards them to our error handler in server.js.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Parse a positive integer or throw a 400 error.
export function toPositiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} must be a positive whole number.`);
  return n;
}
