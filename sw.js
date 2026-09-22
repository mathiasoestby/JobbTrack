// Enkel offline-cache for Timeliste. Legg denne ved siden av timeliste.html.
const CACHE = "timeliste-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./src/main.js",
  "./src/react.js",
  "./src/lib.js",
  "./src/store.js",
  "./src/firebase.js",
  "./src/App.js",
  "./src/components/AuthGate.js",
  "./src/components/Stoppeklokke.js",
  "./src/components/Timeliste.js",
  "./src/components/Lonn.js",
  "./src/components/Jobber.js",
  "./src/components/Kalender.js",
  "./src/components/Entries.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Nettet først, cache som reserve når du er offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
