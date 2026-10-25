/* يعمل بدون إنترنت بعد أول فتح: يخزّن ملفات الواجهة فقط (لا بيانات) */
const CACHE = 'cases-ui-v15';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/print.css',
  'js/store.js', 'js/sigpad.js', 'js/remote.js', 'js/app.js',
  'fonts/Tajawal-Regular.ttf', 'fonts/Tajawal-Medium.ttf', 'fonts/Tajawal-Bold.ttf',
  'fonts/Amiri-Regular.ttf', 'fonts/Amiri-Bold.ttf',
  'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  // cache: 'reload' يتجاوز ذاكرة المتصفح (GitHub Pages يحتفظ بالملفات 10 دقائق) فتُخزَّن النسخة الجديدة فعلًا
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// الشبكة أولًا (لتصل التحديثات)، والنسخة المخزنة عند انقطاع الإنترنت.
// no-cache: يسأل الخادم كل مرة بدل نسخة المتصفح المؤقتة، فيصل التحديث فور نشره
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
