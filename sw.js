// B&B Service Worker — Enhanced with stale-while-revalidate, full page cache, and offline support
const CACHE_NAME = 'bb-cache-v3';
const STATIC_CACHE = 'bb-static-v3';
const DYNAMIC_CACHE = 'bb-dynamic-v3';

// All app pages and critical assets
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/login.html',
    '/hub.html',
    '/project.html',
    '/labour-calendar.html',
    '/economics.html',
    '/funds.html',
    '/payments.html',
    '/materials.html',
    '/settings.html',
    '/compare.html',
    '/about.html',
    '/css/styles-professional.css',
    '/css/styles-construction.css',
    '/css/styles-sidebar.css',
    '/css/settings.css',
    '/css/logo-loader.css',
    '/css/styles.css',
    '/logo.svg',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap'
];

// JS modules to cache
const JS_ASSETS = [
    '/js/app.js',
    '/js/auth.js',
    '/js/auth-check.js',
    '/js/auth-header.js',
    '/js/firebase-config.js',
    '/js/firebase-storage.js',
    '/js/project.js',
    '/js/compare.js',
    '/js/economics-analytics.js',
    '/js/economics-ml.js',
    '/js/economics-guide-overlay.js',
    '/js/financial-calculator.js',
    '/js/fund-management.js',
    '/js/guided-tour.js',
    '/js/labour-calendar.js',
    '/js/materials-stock.js',
    '/js/payments.js',
    '/js/phase-management.js',
    '/js/premium.js',
    '/js/sidebar-dropdown.js',
    '/js/user-preferences.js',
    '/js/vendor-management.js',
    '/js/worker-management.js'
];

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('[SW] Some static assets failed to cache:', err);
                });
            }),
            caches.open(STATIC_CACHE).then((cache) => {
                return cache.addAll(JS_ASSETS).catch(err => {
                    console.warn('[SW] Some JS assets failed to cache:', err);
                });
            })
        ]).then(() => self.skipWaiting())
    );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map(name => {
                        console.log('[SW] Removing old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ==================== FETCH — Stale While Revalidate ====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Firebase/Firestore API requests (they handle their own caching)
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('gstatic.com/firebasejs')) {
        return;
    }

    // For navigation requests — Network first with cache fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        return cached || caches.match('/index.html');
                    });
                })
        );
        return;
    }

    // For static assets — Stale while revalidate
    event.respondWith(
        caches.match(request).then(cached => {
            const fetchPromise = fetch(request).then(networkResponse => {
                // Update cache in background
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
                }
                return networkResponse;
            }).catch(() => cached); // Fall back to cache if network fails

            // Return cached immediately, update in background
            return cached || fetchPromise;
        })
    );
});

// ==================== BACKGROUND SYNC (for offline writes) ====================
self.addEventListener('sync', (event) => {
    if (event.tag === 'bb-offline-sync') {
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_REQUESTED' });
                });
            })
        );
    }
});

// ==================== PUSH NOTIFICATIONS (future) ====================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
