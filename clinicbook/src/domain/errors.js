/** Domain errors. The route layer maps each one to an HTTP status. */
export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
export class UnauthorizedError extends Error {
  constructor(message, { expired = false } = {}) {
    super(message);
    this.name = 'UnauthorizedError';
    this.expired = expired;
  }
}
export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}
export class ConflictError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = 'ConflictError';
    this.details = details;
  }
}
export class LockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LockedError';
  }
}
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}
