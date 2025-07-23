import { Product } from './product';
export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  heroImageUrl?: string;
  products: Product[];
}
