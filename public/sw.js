/* Learning Chinese — service worker
 *
 * Strategy
 *  - Pages & transcript JSON: network first, cache fallback (fresh data when online, works offline).
 *  - Hashed build assets, icons, fonts: cache first (they never change under the same URL).
 *  - Audio: cache first with HTTP Range support. The page stores the full file in AUDIO_CACHE
 *    after a lesson loads; <audio> asks for byte ranges, so we slice the cached file into a 206.
 */
const VERSION = 'v1';
const SHELL_CACHE = `lc-shell-${VERSION}`;
const ASSET_CACHE = `lc-assets-${VERSION}`;
const AUDIO_CACHE = 'lc-audio-v1'; // shared with src/offline.js — keep in sync

const SHELL = ['./', './index.html', './manifest.webmanifest', './data/course_index.json', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, AUDIO_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lc-') && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

/** Serve audio from the cache, honouring Range requests; fall through to the network otherwise. */
async function audio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(request.url, { ignoreSearch: true });
  if (!hit) return fetch(request);

  const range = request.headers.get('range');
  if (!range) return hit;

  const blob = await hit.blob();
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  if (start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.destination === 'audio' || /\.(mp3|m4a|aac|ogg|opus)$/i.test(url.pathname)) {
    event.respondWith(audio(request));
    return;
  }
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
