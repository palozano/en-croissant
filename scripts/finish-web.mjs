import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = new URL("../dist-web/", import.meta.url);
const assets = (await readdir(new URL("assets/", directory))).map((name) => `assets/${name}`);
const files = [
  "index.html",
  ...assets,
  "pieces/cburnett.css",
  "board/green.png",
  "stockfish/stockfish-19-lite-single.js",
  "stockfish/stockfish-19-lite-single.wasm",
  "stockfish/COPYING.txt",
  "stockfish/SOURCES.txt",
];
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(new URL(file, directory)));
const cacheName = `schaak-web-${hash.digest("hex").slice(0, 16)}`;
await writeFile(
  new URL("sw.js", directory),
  `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(files.map((file) => `./${file}`))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('schaak-web-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('./index.html', self.registration.scope))));
  } else {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request)));
  }
});\n`,
);
console.log(`Browser build prepared for offline use (${cacheName}).`);
