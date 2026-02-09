/* eslint-disable no-restricted-globals */
/**
 * Minimal service worker for installability + offline fallback.
 * Keeps caching simple to avoid surprising behavior for Q&A content.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `uit-qna-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/offline', '/icon.svg', '/maskable-icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('uit-qna-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      self.clients.claim();
    })(),
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!isSameOrigin(req.url)) return;

  const isNavigation = req.mode === 'navigate';
  const dest = req.destination;
  const isAsset = dest === 'script' || dest === 'style' || dest === 'image' || dest === 'font';

  // Cache-first for static assets.
  if (isAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Network-first for navigations, fallback to offline page.
  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const offline = await cache.match('/offline');
          return offline || Response.error();
        }
      })(),
    );
  }
});

