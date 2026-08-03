// Service Worker for PWA and Web Push Notifications
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activate');
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Standard network fetching
});

// Handle Background Web Push Notifications even when browser/tab is closed
self.addEventListener('push', (event) => {
    let data = {
        title: 'ChitChat Notification',
        body: 'You have a new message!',
        icon: '/icon.svg',
        badge: '/icon.svg',
        url: '/',
        roomId: 'lobby'
    };

    if (event.data) {
        try {
            data = Object.assign(data, event.data.json());
        } catch (err) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icon.svg',
        badge: data.badge || '/icon.svg',
        data: {
            url: data.url || '/',
            roomId: data.roomId
        },
        tag: 'chitchat-msg-' + Date.now(),
        renotify: true,
        requireInteraction: false,
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'Open Chat' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data ? event.notification.data.url : '/';
    const targetRoomId = event.notification.data ? event.notification.data.roomId : null;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    if (targetRoomId && client.postMessage) {
                        client.postMessage({ type: 'OPEN_ROOM', roomId: targetRoomId });
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
