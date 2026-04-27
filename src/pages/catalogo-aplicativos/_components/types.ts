export type BoxiconName = `boxicons:${string}`;

export interface CatalogBundle {
  title: string;
  description: string;
  url?: string;
}

export interface CatalogVariant {
  id: string;
  version: string;
  description: string;
  url?: string;
}

export interface CatalogItem {
  id: string;
  title: string;
  type: string;
  version?: string;
  description: string;
  url?: string;
  variants?: CatalogVariant[];
}

export interface CatalogViewModel {
  bundle: CatalogBundle;
  items: CatalogItem[];
}
