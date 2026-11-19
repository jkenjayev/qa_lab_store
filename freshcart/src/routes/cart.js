import { Router } from 'express';
import { cartIdOf } from './http.js';

export function cartRouter({ cartService }) {
  const router = Router();
  const id = cartIdOf;
  router.get('/api/cart', (req, res) => res.json(cartService.get(id(req))));
  router.post('/api/cart/items', (req, res) =>
    res.json(cartService.addItem(id(req), req.body?.productId, req.body?.quantity ?? 1)),
  );
  router.patch('/api/cart/lines/:lineId', (req, res) =>
    res.json(cartService.setQuantity(id(req), req.params.lineId, req.body?.quantity)),
  );
  router.delete('/api/cart/lines/:lineId', (req, res) =>
    res.json(cartService.remove(id(req), req.params.lineId)),
  );
  router.post('/api/cart/promo', (req, res) => res.json(cartService.applyPromo(id(req), req.body?.code)));
  router.delete('/api/cart/promo', (req, res) => res.json(cartService.removePromo(id(req))));
  router.post('/api/cart/clear', (req, res) => res.json(cartService.clear(id(req))));
  return router;
}
