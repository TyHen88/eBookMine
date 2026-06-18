// Client-safe shared types (no runtime deps), mirrored by src/lib/metadata.ts.

export interface Bookmark {
  page: number;
  label: string;
  createdAt: string;
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  fileName: string;
  pageCount: number;
  category: string;
  tags: string[];
  favorite: boolean;
  cover: string | null;
  addedAt: string;
  lastPage: number;
  bookmarks: Bookmark[];
  sizeBytes: number;
}
