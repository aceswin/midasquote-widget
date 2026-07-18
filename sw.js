// Minimal service worker — its only job is to exist and respond to fetch
// events, since that's one of the requirements Chrome checks before it'll
// offer a real "Install" prompt instead of treating this as just a
// bookmarked page. Doesn't cache anything or change how the page behaves
// in any way.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});