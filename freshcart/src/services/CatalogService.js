import { categoryCounts, listProducts, suggest } from '../domain/catalog.js';
import { NotFoundError } from '../domain/errors.js';

/** Catalog use cases. Depends on a product repository interface (all, byId). */
export class CatalogService {
  constructor({ productRepo, categories, defects }) {
    this.productRepo = productRepo;
    this.categories = categories;
    this.defects = defects;
  }

  list(query) {
    return listProducts(this.productRepo.all(), query, { defects: this.defects });
  }

  details(id) {
    const product = this.productRepo.byId(Number(id));
    if (!product) throw new NotFoundError('Mahsulot topilmadi');
    return product;
  }

  suggest(term) {
    return suggest(this.productRepo.all(), term, this.defects);
  }

  categoryList() {
    return categoryCounts(this.productRepo.all(), this.categories);
  }
}
