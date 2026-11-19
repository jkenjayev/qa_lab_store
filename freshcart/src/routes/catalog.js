import { Router } from 'express';
import { productImageSvg } from '../domain/images.js';
import { wrap } from './http.js';

export function catalogRouter({ catalogService }) {
  const router = Router();
  router.get('/api/categories', (_req, res) => res.json(catalogService.categoryList()));
  router.get('/api/products', (req, res) => res.json(catalogService.list(req.query)));
  router.get('/api/products/:id', (req, res) => res.json(catalogService.details(req.params.id)));
  router.get('/api/suggest', (req, res) => res.json(catalogService.suggest(req.query.q)));
  router.get(
    '/img/:id/:n.svg',
    wrap(async (req, res) => {
      const product = catalogService.details(req.params.id);
      res.type('image/svg+xml').send(productImageSvg(product, Number(req.params.n)));
    }),
  );
  return router;
}
