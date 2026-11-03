/**
 * Double Deezz The Food Cafe - Firebase Architecture & Service Layer
 * Supports Firebase v9/v10 Compat & Fallback Sync Engine
 */

(function (window) {
  'use strict';

  // Default configuration storage key
  const STORAGE_KEY = 'doubledeezz_firebase_config';
  const SETTINGS_KEY = 'doubledeezz_settings';
  const MENU_CACHE_KEY = 'doubledeezz_menu_cache';

  // Default initial configuration structure
  const DEFAULT_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

  let appInstance = null;
  let authInstance = null;
  let firestoreInstance = null;
  let storageInstance = null;
  let activeMenuUnsubscribe = null;
  let activeSettingsUnsubscribe = null;
  let activeOrdersUnsubscribe = null;

  function getStoredConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) {
          return parsed;
        }
      }
    } catch (e) {}
    if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.projectId) {
      return window.__FIREBASE_CONFIG__;
    }
    return null;
  }

  function isFirebaseConfigured() {
    const cfg = getStoredConfig();
    return !!(cfg && cfg.projectId && cfg.apiKey && cfg.apiKey.length > 5);
  }

  function initFirebase(customConfig = null) {
    const config = customConfig || getStoredConfig();
    if (!config || !config.apiKey || !config.projectId) {
      console.log('ℹ️ Firebase credentials not configured. Running in high-performance local/server mode.');
      return false;
    }

    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not yet loaded in DOM.');
        return false;
      }

      // Check if already initialized
      if (!firebase.apps || !firebase.apps.length) {
        appInstance = firebase.initializeApp(config);
      } else {
        appInstance = firebase.app();
      }

      authInstance = firebase.auth();
      firestoreInstance = firebase.firestore();
      try {
        storageInstance = firebase.storage();
      } catch (e) {
        console.log('Firebase storage optional module status:', e.message);
      }

      console.log('✅ Firebase initialized successfully with Project:', config.projectId);
      return true;
    } catch (err) {
      console.error('Firebase initialization error:', err);
      return false;
    }
  }

  // --- Real-time Listeners and Cloud Sync ---

  function subscribeToMenu(onUpdate, onError) {
    if (activeMenuUnsubscribe) {
      try { activeMenuUnsubscribe(); } catch (e) {}
      activeMenuUnsubscribe = null;
    }

    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        // Primary Firestore doc: 'restaurant/menu'
        activeMenuUnsubscribe = firestoreInstance.collection('restaurant').doc('menu')
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              if (data && data._categories) {
                localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
                onUpdate(data, 'firebase');
                return;
              }
            }
            // If document doesn't exist yet, fallback to local/server
            loadFallbackMenu(onUpdate);
          }, (err) => {
            console.warn('Firestore menu listener warning:', err);
            loadFallbackMenu(onUpdate);
            if (onError) onError(err);
          });
        return;
      } catch (e) {
        console.warn('Could not attach Firestore listener, falling back:', e);
      }
    }

    loadFallbackMenu(onUpdate);
  }

  function loadFallbackMenu(callback) {
    // Check cached
    const cached = localStorage.getItem(MENU_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed._categories) {
          callback(parsed, 'cache');
        }
      } catch (e) {}
    }

    // Fetch from /api/menu or menu.json
    fetch('./menu.json?t=' + Date.now())
      .then(res => res.json())
      .then(data => {
        if (data && data._categories) {
          localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
          callback(data, 'server');
        }
      })
      .catch(err => {
        console.error('Error loading fallback menu:', err);
      });
  }

  function subscribeToSettings(onUpdate) {
    if (activeSettingsUnsubscribe) {
      try { activeSettingsUnsubscribe(); } catch (e) {}
      activeSettingsUnsubscribe = null;
    }

    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        activeSettingsUnsubscribe = firestoreInstance.collection('restaurant').doc('settings')
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
              onUpdate(data);
              return;
            }
            fetchLocalSettings(onUpdate);
          }, (err) => {
            fetchLocalSettings(onUpdate);
          });
        return;
      } catch (e) {}
    }

    fetchLocalSettings(onUpdate);
  }

  function fetchLocalSettings(callback) {
    const cached = localStorage.getItem(SETTINGS_KEY);
    if (cached) {
      try { callback(JSON.parse(cached)); } catch (e) {}
    }
    fetch('./api/settings')
      .then(res => res.json())
      .then(settings => {
        if (settings && settings.name) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
          callback(settings);
        }
      })
      .catch(() => {});
  }

  function subscribeToOrders(onUpdate) {
    if (activeOrdersUnsubscribe) {
      try { activeOrdersUnsubscribe(); } catch (e) {}
      activeOrdersUnsubscribe = null;
    }

    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        activeOrdersUnsubscribe = firestoreInstance.collection('orders')
          .orderBy('timestamp', 'desc')
          .limit(100)
          .onSnapshot((snapshot) => {
            const orders = [];
            snapshot.forEach(doc => {
              orders.push({ id: doc.id, ...doc.data() });
            });
            onUpdate(orders);
          }, (err) => {
            console.warn('Orders live listener fell back to API polling:', err);
            fetchOrdersFromApi(onUpdate);
          });
        return;
      } catch (e) {}
    }

    fetchOrdersFromApi(onUpdate);
  }

  function fetchOrdersFromApi(callback) {
    fetch('./api/orders')
      .then(res => res.json())
      .then(orders => {
        if (Array.isArray(orders)) callback(orders);
      })
      .catch(() => callback([]));
  }

  // --- Push / Save methods ---

  async function saveMenuToCloud(menuData) {
    let cloudSaved = false;
    // 1. Firebase Firestore save
    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        await firestoreInstance.collection('restaurant').doc('menu').set(menuData, { merge: true });
        cloudSaved = true;
      } catch (e) {
        console.error('Failed saving menu to Firestore:', e);
      }
    }

    // 2. Local API save
    try {
      const res = await fetch('./api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuData)
      });
      if (res.ok) cloudSaved = true;
    } catch (e) {}

    // 3. LocalStorage cache
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menuData));
    return cloudSaved;
  }

  async function saveOrderToCloud(order) {
    let orderSaved = false;
    const orderId = order.id || 'DD-' + Date.now().toString(36).toUpperCase();
    const cleanOrder = {
      ...order,
      id: orderId,
      timestamp: order.timestamp || new Date().toISOString(),
      status: order.status || 'Pending'
    };

    // 1. Firestore save
    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        await firestoreInstance.collection('orders').doc(orderId).set(cleanOrder);
        orderSaved = true;
      } catch (e) {
        console.error('Firestore order save error:', e);
      }
    }

    // 2. Local API save
    try {
      const res = await fetch('./api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanOrder)
      });
      if (res.ok) orderSaved = true;
    } catch (e) {}

    return { success: orderSaved, orderId };
  }

  async function updateOrderStatus(orderId, status) {
    let updated = false;
    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        await firestoreInstance.collection('orders').doc(orderId).update({ status, updatedAt: new Date().toISOString() });
        updated = true;
      } catch (e) {}
    }

    try {
      const res = await fetch('./api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });
      if (res.ok) updated = true;
    } catch (e) {}

    return updated;
  }

  async function saveSettings(settings) {
    let saved = false;
    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        await firestoreInstance.collection('restaurant').doc('settings').set(settings, { merge: true });
        saved = true;
      } catch (e) {}
    }

    try {
      const res = await fetch('./api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) saved = true;
    } catch (e) {}

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return saved;
  }

  async function seedFirestore(menuData) {
    if (!firestoreInstance) throw new Error('Firebase Firestore not initialized.');
    // Seed menu
    await firestoreInstance.collection('restaurant').doc('menu').set(menuData);
    // Seed settings
    if (menuData._settings) {
      await firestoreInstance.collection('restaurant').doc('settings').set(menuData._settings);
    }
    return true;
  }

  // Export API to global window object
  window.DoubleDeezzFirebase = {
    init: initFirebase,
    isConfigured: isFirebaseConfigured,
    getConfig: getStoredConfig,
    setConfig: function (config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return initFirebase(config);
    },
    removeConfig: function () {
      localStorage.removeItem(STORAGE_KEY);
    },
    getAuth: function () { return authInstance; },
    getFirestore: function () { return firestoreInstance; },
    getStorage: function () { return storageInstance; },
    subscribeToMenu,
    subscribeToSettings,
    subscribeToOrders,
    saveMenuToCloud,
    saveOrderToCloud,
    updateOrderStatus,
    saveSettings,
    seedFirestore
  };

  // Auto-init on load if config exists
  window.addEventListener('DOMContentLoaded', () => {
    initFirebase();
  });

})(window);
