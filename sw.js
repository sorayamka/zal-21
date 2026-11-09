// Сеть первой (чтобы обновления доходили), кэш — когда в зале нет интернета.
// Всё приложение и видео кэшируются при установке: офлайн работает с первого запуска
var C = 'zal2-v12';
var FILES = ['./', 'index.html', 'style.css', 'logic.js', 'data.js', 'app.js', 'manifest.json', 'icon.png',
  'media/cableLat.mp4', 'media/cableRow.mp4', 'media/calf.mp4', 'media/chestPress.mp4', 'media/crunch.mp4', 'media/dbFlat.mp4',
  'media/facePull.mp4', 'media/hammer.mp4', 'media/inclineDB.mp4', 'media/lateral.mp4', 'media/legCurl.mp4', 'media/legExt.mp4',
  'media/legPress.mp4', 'media/pecDeck.mp4', 'media/pulldown.mp4', 'media/pushdown.mp4', 'media/rdl.mp4', 'media/scottCurl.mp4',
  'media/dbRow1.svg', 'media/dbRow2.svg', 'media/hack.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url.split('#')[0];
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(function (r) {
    if (r.status === 200) { var copy = r.clone(); caches.open(C).then(function (c) { c.put(url, copy); }); }
    return r;
  }).catch(function () { return caches.match(url, { ignoreSearch: true }); }));
});
