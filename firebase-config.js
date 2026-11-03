/**
 * Double Deezz The Food Cafe - Enterprise Real-Time Cloud Engine
 * Seamlessly manages live menu updates, order tracking, and restaurant settings.
 */

(function (window) {
  'use strict';

  // Active Embedded Cloud Configuration
  const EMBEDDED_CLOUD_CONFIG = {
    apiKey: "AIzaSyC2CUZYQvkXM1v73NPPj7TTMHi1guw3lXk",
    authDomain: "doubledeezz.firebaseapp.com",
    databaseURL: "https://doubledeezz-default-rtdb.firebaseio.com",
    projectId: "doubledeezz",
    storageBucket: "doubledeezz.firebasestorage.app",
    messagingSenderId: "647790444183",
    appId: "1:647790444183:web:e18cc4abf927ded7daf3d2",
    measurementId: "G-E3D0N7Z8GR"
  };

  const STORAGE_KEY = 'doubledeezz_cloud_config';
  const SETTINGS_KEY = 'doubledeezz_settings';
  const MENU_CACHE_KEY = 'doubledeezz_menu_cache';

  let appInstance = null;
  let authInstance = null;
  let firestoreInstance = null;
  let databaseInstance = null;
  let storageInstance = null;

  let activeMenuUnsubscribe = null;
  let activeSettingsUnsubscribe = null;
  let activeOrdersUnsubscribe = null;

  function getEffectiveConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) return parsed;
      }
    } catch (e) {}

    if (window.__CLOUD_CONFIG__ && window.__CLOUD_CONFIG__.projectId) {
      return window.__CLOUD_CONFIG__;
    }

    return EMBEDDED_CLOUD_CONFIG;
  }

  function isConfigured() {
    const cfg = getEffectiveConfig();
    return !!(cfg && cfg.apiKey && (cfg.projectId || cfg.databaseURL));
  }

  function initEngine(customConfig = null) {
    const config = customConfig || getEffectiveConfig();
    if (!config || !config.apiKey) return false;

    try {
      if (typeof firebase === 'undefined') {
        return false;
      }

      if (!firebase.apps || !firebase.apps.length) {
        appInstance = firebase.initializeApp(config);
      } else {
        appInstance = firebase.app();
      }

      // Initialize Realtime Database (Primary Live Engine)
      try {
        if (typeof firebase.database === 'function' && config.databaseURL) {
          databaseInstance = firebase.database();
        }
      } catch (e) {}

      // Initialize Cloud Firestore
      try {
        if (typeof firebase.firestore === 'function') {
          firestoreInstance = firebase.firestore();
        }
      } catch (e) {}

      // Initialize Auth
      try {
        if (typeof firebase.auth === 'function') {
          authInstance = firebase.auth();
        }
      } catch (e) {}

      // Initialize Storage
      try {
        if (typeof firebase.storage === 'function') {
          storageInstance = firebase.storage();
        }
      } catch (e) {}

      return true;
    } catch (err) {
      return false;
    }
  }

  // =========================================================================
  // REAL-TIME MENU SUBSCRIPTION (Instant propagation on change)
  // =========================================================================

  function subscribeToMenu(onUpdate, onError) {
    if (activeMenuUnsubscribe) {
      try { activeMenuUnsubscribe(); } catch (e) {}
      activeMenuUnsubscribe = null;
    }

    // 1. Primary: Realtime Database Live Listener (Instant)
    if (databaseInstance) {
      try {
        const menuRef = databaseInstance.ref('menu');
        const listener = menuRef.on('value', (snapshot) => {
          const data = snapshot.val();
          if (data && data._categories) {
            localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
            onUpdate(data, 'live_stream');
          } else {
            // Auto-fill from local fallback if empty
            autoFillLiveMenu(onUpdate);
          }
        }, (err) => {
          fallbackMenuLoader(onUpdate);
        });

        activeMenuUnsubscribe = () => menuRef.off('value', listener);
        return;
      } catch (e) {}
    }

    // 2. Secondary: Firestore Live Document Listener
    if (firestoreInstance) {
      try {
        activeMenuUnsubscribe = firestoreInstance.collection('restaurant').doc('menu')
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              if (data && data._categories) {
                localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
                onUpdate(data, 'live_stream');
                return;
              }
            }
            fallbackMenuLoader(onUpdate);
          }, (err) => {
            fallbackMenuLoader(onUpdate);
          });
        return;
      } catch (e) {}
    }

    // 3. Fallback loader
    fallbackMenuLoader(onUpdate);
  }

  // Auto-fill live database if empty
  async function autoFillLiveMenu(onUpdate) {
    try {
      const res = await fetch('./menu.json?t=' + Date.now());
      const data = await res.json();
      if (data && data._categories) {
        if (databaseInstance) {
          databaseInstance.ref('menu').set(data);
          if (data._settings) databaseInstance.ref('settings').set(data._settings);
        }
        localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
        onUpdate(data, 'local_seed');
      }
    } catch (e) {
      fallbackMenuLoader(onUpdate);
    }
  }

  function fallbackMenuLoader(callback) {
    const cached = localStorage.getItem(MENU_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed._categories) {
          callback(parsed, 'cache');
        }
      } catch (e) {}
    }

    fetch('./menu.json?t=' + Date.now())
      .then(r => r.json())
      .then(data => {
        if (data && data._categories) {
          localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
          callback(data, 'server');
        }
      })
      .catch(() => {});
  }

  // =========================================================================
  // REAL-TIME SETTINGS & RESTAURANT POLICIES
  // =========================================================================

  function subscribeToSettings(onUpdate) {
    if (activeSettingsUnsubscribe) {
      try { activeSettingsUnsubscribe(); } catch (e) {}
      activeSettingsUnsubscribe = null;
    }

    if (databaseInstance) {
      try {
        const settingsRef = databaseInstance.ref('settings');
        const listener = settingsRef.on('value', (snap) => {
          const val = snap.val();
          if (val && val.name) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(val));
            onUpdate(val);
          }
        });
        activeSettingsUnsubscribe = () => settingsRef.off('value', listener);
        return;
      } catch (e) {}
    }

    if (firestoreInstance) {
      try {
        activeSettingsUnsubscribe = firestoreInstance.collection('restaurant').doc('settings')
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
              onUpdate(data);
            }
          });
        return;
      } catch (e) {}
    }

    // Local fetch
    fetch('./api/settings')
      .then(r => r.json())
      .then(s => { if (s && s.name) onUpdate(s); })
      .catch(() => {});
  }

  // =========================================================================
  // REAL-TIME ORDERS STREAM
  // =========================================================================

  function subscribeToOrders(onUpdate) {
    if (activeOrdersUnsubscribe) {
      try { activeOrdersUnsubscribe(); } catch (e) {}
      activeOrdersUnsubscribe = null;
    }

    if (databaseInstance) {
      try {
        const ordersRef = databaseInstance.ref('orders');
        const listener = ordersRef.limitToLast(100).on('value', (snap) => {
          const orders = [];
          snap.forEach(child => {
            orders.unshift({ id: child.key, ...child.val() });
          });
          onUpdate(orders);
        });
        activeOrdersUnsubscribe = () => ordersRef.off('value', listener);
        return;
      } catch (e) {}
    }

    // Fallback: poll server orders API
    fetch('./api/orders')
      .then(r => r.json())
      .then(orders => { if (Array.isArray(orders)) onUpdate(orders); })
      .catch(() => onUpdate([]));
  }

  // =========================================================================
  // DISPATCH ORDER (Recorded simultaneously to Cloud Database & Local Server)
  // =========================================================================

  async function saveOrderToCloud(order) {
    const orderId = order.id || 'DD-' + Date.now().toString(36).toUpperCase();
    const cleanOrder = {
      ...order,
      id: orderId,
      timestamp: order.timestamp || new Date().toISOString(),
      status: order.status || 'Pending'
    };

    let saved = false;

    // 1. Live Cloud Database write
    if (databaseInstance) {
      try {
        await databaseInstance.ref('orders').child(orderId).set(cleanOrder);
        saved = true;
      } catch (e) {}
    }

    // 2. Direct REST write fallback
    const config = getEffectiveConfig();
    if (config.databaseURL) {
      try {
        await fetch(`${config.databaseURL}/orders/${orderId}.json?key=${config.apiKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanOrder)
        });
        saved = true;
      } catch (e) {}
    }

    // 3. Cloud Firestore write
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('orders').doc(orderId).set(cleanOrder);
        saved = true;
      } catch (e) {}
    }

    // 4. Local Server write
    try {
      await fetch('./api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanOrder)
      });
      saved = true;
    } catch (e) {}

    return { success: saved, orderId };
  }

  async function updateOrderStatus(orderId, status) {
    let ok = false;
    if (databaseInstance) {
      try {
        await databaseInstance.ref('orders').child(orderId).update({
          status,
          updatedAt: new Date().toISOString()
        });
        ok = true;
      } catch (e) {}
    }

    const config = getEffectiveConfig();
    if (config.databaseURL) {
      try {
        await fetch(`${config.databaseURL}/orders/${orderId}/status.json?key=${config.apiKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(status)
        });
        ok = true;
      } catch (e) {}
    }

    try {
      await fetch('./api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });
      ok = true;
    } catch (e) {}

    return ok;
  }

  // =========================================================================
  // SAVE MENU & SETTINGS (INSTANT ALL-PHONE BROADCAST)
  // =========================================================================

  async function saveMenuToCloud(menuData) {
    let saved = false;

    // 1. Realtime Database (Broadcasts instantly to all phones)
    if (databaseInstance) {
      try {
        await databaseInstance.ref('menu').set(menuData);
        saved = true;
      } catch (e) {}
    }

    const config = getEffectiveConfig();
    if (config.databaseURL) {
      try {
        await fetch(`${config.databaseURL}/menu.json?key=${config.apiKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(menuData)
        });
        saved = true;
      } catch (e) {}
    }

    // 2. Cloud Firestore
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('restaurant').doc('menu').set(menuData, { merge: true });
        saved = true;
      } catch (e) {}
    }

    // 3. Local API
    try {
      await fetch('./api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuData)
      });
      saved = true;
    } catch (e) {}

    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menuData));
    return saved;
  }

  async function saveSettings(settings) {
    let saved = false;
    if (databaseInstance) {
      try {
        await databaseInstance.ref('settings').set(settings);
        saved = true;
      } catch (e) {}
    }

    const config = getEffectiveConfig();
    if (config.databaseURL) {
      try {
        await fetch(`${config.databaseURL}/settings.json?key=${config.apiKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        saved = true;
      } catch (e) {}
    }

    try {
      await fetch('./api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      saved = true;
    } catch (e) {}

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return saved;
  }

  // =========================================================================
  // SEED DATABASE ENGINE
  // =========================================================================

  async function seedLiveDatabase(menuData) {
    const config = getEffectiveConfig();
    const baseUrl = config.databaseURL;
    const key = config.apiKey;

    if (baseUrl) {
      await fetch(`${baseUrl}/menu.json?key=${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuData)
      });
      if (menuData._settings) {
        await fetch(`${baseUrl}/settings.json?key=${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(menuData._settings)
        });
      }
      if (menuData._categories) {
        await fetch(`${baseUrl}/categories.json?key=${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(menuData._categories)
        });
      }
    }

    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('restaurant').doc('menu').set(menuData);
        if (menuData._settings) {
          await firestoreInstance.collection('restaurant').doc('settings').set(menuData._settings);
        }
      } catch (e) {}
    }

    return true;
  }

  // =========================================================================
  // PUBLIC API INTERFACE
  // =========================================================================

  window.DoubleDeezzFirebase = {
    init: initEngine,
    isConfigured,
    getConfig: getEffectiveConfig,
    setConfig: function (config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return initEngine(config);
    },
    removeConfig: function () {
      localStorage.removeItem(STORAGE_KEY);
    },
    getAuth: function () { return authInstance; },
    getDatabase: function () { return databaseInstance; },
    getFirestore: function () { return firestoreInstance; },
    getStorage: function () { return storageInstance; },
    subscribeToMenu,
    subscribeToSettings,
    subscribeToOrders,
    saveMenuToCloud,
    saveOrderToCloud,
    updateOrderStatus,
    saveSettings,
    seedFirestore: seedLiveDatabase,
    seedLiveDatabase
  };

  // Auto-init on page load
  window.addEventListener('DOMContentLoaded', () => {
    initEngine();
  });

})(window);
