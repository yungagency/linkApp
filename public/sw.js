// Service worker LinkApp : l'application s'ouvre même avec une connexion faible.
// Stratégie : réseau d'abord pour les pages, cache en secours ; cache d'abord pour les fichiers statiques.
const CACHE = 'linkapp-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './logo-mark.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Jamais de cache pour l'API Supabase (données à jour, sessions).
  if (url.hostname.endsWith('supabase.co')) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')))
    return
  }
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })),
    )
  }
})
