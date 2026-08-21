"use client";

const CACHE_NAME = "ebookmine-pdf-cache-v1";
const prefetchedUrls = new Set<string>();

/**
 * Checks if the browser CacheStorage API is available.
 */
function isCacheAvailable(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

/**
 * Prefetches a PDF file into the browser CacheStorage in the background.
 * Triggers on hover or touch before the user clicks to open a book.
 */
export async function prefetchPdf(url: string): Promise<void> {
  if (!isCacheAvailable() || !url || prefetchedUrls.has(url)) return;

  prefetchedUrls.add(url);

  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(url);
    if (match) return; // Already cached

    // Low-priority background fetch
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/pdf,*/*" },
    });

    if (response.ok && response.status === 200) {
      await cache.put(url, response);
    }
  } catch {
    /* Prefetch is best-effort and should never throw */
  }
}

/**
 * Retrieves a cached Blob URL or ArrayBuffer if available in CacheStorage.
 * Returns null if not cached yet.
 */
export async function getCachedPdfBlob(url: string): Promise<Blob | null> {
  if (!isCacheAvailable() || !url) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(url);
    if (match && match.ok) {
      return await match.blob();
    }
  } catch {
    /* Cache read error fallback */
  }
  return null;
}

/**
 * Clears old PDF cache entries if needed.
 */
export async function clearPdfCache(): Promise<void> {
  if (!isCacheAvailable()) return;
  try {
    await caches.delete(CACHE_NAME);
    prefetchedUrls.clear();
  } catch {}
}
