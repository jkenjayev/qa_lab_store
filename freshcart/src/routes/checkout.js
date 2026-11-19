import { Router } from 'express';
import { ValidationError } from '../domain/errors.js';
import { validateEmail } from '../shared/validation.js';
import { cartIdOf, wrap } from './http.js';

export function checkoutRouter({ checkoutService, catalogService, features }) {
  const router = Router();
  router.get('/api/delivery/slots', (_req, res) => res.json({ days: checkoutService.slots() }));
  router.post('/api/checkout/delivery', (req, res) =>
    res.json(checkoutService.setDelivery(cartIdOf(req), req.body ?? {})),
  );
  router.post(
    '/api/checkout/pay',
    wrap(async (req, res) => res.status(201).json(await checkoutService.pay(cartIdOf(req), req.body ?? {}))),
  );
  router.get('/api/orders/:number', (req, res) => res.json(checkoutService.getOrder(req.params.number)));
  router.get('/api/dev/orders', (_req, res) => res.json(checkoutService.listOrders()));

  // F1.5 Notify me is a stub in the training build: the endpoint only exists once the feature is built.
  if (features.notifyMe) {
    router.post('/api/notify-me', (req, res) => {
      const message = validateEmail(req.body?.email);
      if (message) throw new ValidationError(message);
      catalogService.details(req.body?.productId);
      res.status(201).json({ ok: true });
    });
  }
  return router;
}
