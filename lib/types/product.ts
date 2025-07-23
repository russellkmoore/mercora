export interface Product {
  id: number;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  primaryImageUrl: string | null;
  images: string[];
  price: number;             // in cents
  salePrice?: number;
  onSale?: boolean;
  active: boolean;
  quantityInStock: number;
  availability: 'available' | 'coming_soon';
  tags: string[];
  useCases: string[];
  attributes: Record<string, string>;
  aiNotes?: string;
}