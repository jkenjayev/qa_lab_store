/** Errors carry their HTTP status so routes stay thin. */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.extra = extra;
  }
}

/** Input broke a rule. `fieldErrors` maps field name to message. */
export class ValidationError extends HttpError {
  constructor(message, fieldErrors) {
    super(400, message, fieldErrors ? { fieldErrors } : {});
  }
}

export class NotFoundError extends HttpError {
  constructor(message) {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message) {
    super(409, message);
  }
}

export class PaymentDeclinedError extends HttpError {
  constructor(message = "To'lov rad etildi. Boshqa kartani sinab ko'ring.") {
    super(402, message);
  }
}
