// Pictures made while a book is imported (tables and figures of a PDF, images of an
// EPUB), before the book has its id: services/reader stores them under "<id>:<key>".
import type { ParsedBook } from '@/domain/reader/book';

export interface PendingAsset {
  key: string;
  blob: Blob;
}

export type ParsedWithAssets = ParsedBook & { assets: PendingAsset[] };
