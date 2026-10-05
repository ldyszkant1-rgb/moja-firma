const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE_NAME = 'aeroinstal-pwa-' + BUILD_ID

self.addEventListener('install', () => {
  // New versions wait for the user to choose "Odśwież" in the app banner.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('aeroinstal-pwa-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
})
