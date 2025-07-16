// Firebase Cloud Messaging Service Worker
// Import the latest version
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBUv1_PFKKTkChLe2QTBR0OS04Z9WxcA34",
  authDomain: "gemini-alert.firebaseapp.com",
  projectId: "gemini-alert",
  storageBucket: "gemini-alert.appspot.com",
  messagingSenderId: "122544434135",
  appId: "1:122544434135:web:7c559f7121eada9fdfb992",
  measurementId: "G-WM9KGWW1DR",
  databaseURL: "https://gemini-alert-default-rtdb.firebaseio.com"
});
// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();
// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };
  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});
// Service worker lifecycle events
self.addEventListener('install', (event) => {
});
self.addEventListener('activate', (event) => {
});
// Optional: Add custom click handler for notifications
self.addEventListener('notificationclick', (event) => {
  // Close notification
  event.notification.close();
  // Handle click action - open window to the alert
  const alertId = event.notification.data?.alertId;
  if (alertId) {
    // Navigate to the alert page with this ID
    const urlToOpen = new URL(`/alert/${alertId}`, self.location.origin).href;
    // Open or focus on the relevant page
    event.waitUntil(
      clients.matchAll({type: 'window'}).then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window/tab is open with the URL, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
}); 