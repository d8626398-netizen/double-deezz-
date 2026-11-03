/**
 * Double Deezz The Food Cafe - Complete Firebase Service Layer
 * Supports Firebase Authentication, Cloud Firestore (Real-time), and Firebase Storage.
 */

(function (window) {
  'use strict';

  // =========================================================================
  // 1. EMBEDDED FIREBASE CONFIGURATION
  // You can paste your Firebase Web App credentials directly here,
  // OR configure them through the Admin Portal (/admin -> Restaurant Settings).
  // =========================================================================
  const EMBEDDED_FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

  const STORAGE_KEY = 'doubledeezz_firebase_config';
  const SETTINGS_KEY = 'doubledeezz_settings';
  const MENU_CACHE_KEY = 'doubledeezz_menu_cache';

  let appInstance = null;
  let authInstance = null;
  let firestoreInstance = null;
  let storageInstance = null;

  let activeMenuUnsubscribe = null;
  let activeSettingsUnsubscribe = null;
  let activeOrdersUnsubscribe = null;

  // Retrieve effective configuration (Priority: localStorage > window.__FIREBASE_CONFIG__ > EMBEDDED)
  function getEffectiveConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) return parsed;
      }
    } catch (e) {}

    if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.projectId) {
      return window.__FIREBASE_CONFIG__;
    }

    if (EMBEDDED_FIREBASE_CONFIG.projectId && EMBEDDED_FIREBASE_CONFIG.apiKey) {
      return EMBEDDED_FIREBASE_CONFIG;
    }

    return null;
  }

  function isFirebaseConfigured() {
    const cfg = getEffectiveConfig();
    return !!(cfg && cfg.projectId && cfg.apiKey && cfg.apiKey.length > 5);
  }

  function initFirebase(customConfig = null) {
    const config = customConfig || getEffectiveConfig();
    if (!config || !config.apiKey || !config.projectId) {
      console.log('ℹ️ Firebase credentials not provided yet. System running in high-performance local/server mode.');
      return false;
    }

    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK script not loaded in page.');
        return false;
      }

      // Initialize App if not already initialized
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
        console.log('Firebase Storage optional module status:', e.message);
      }

      console.log('🔥 Firebase initialized successfully! Project:', config.projectId);
      return true;
    } catch (err) {
      console.error('Firebase initialization error:', err);
      return false;
    }
  }

  // =========================================================================
  // 2. FIREBASE AUTHENTICATION (ADMIN ACCESS)
  // =========================================================================

  function signInWithEmail(email, password) {
    if (!authInstance) return Promise.reject(new Error('Firebase Auth not initialized'));
    return authInstance.signInWithEmailAndPassword(email, password);
  }

  function registerAdminAccount(email, password) {
    if (!authInstance) return Promise.reject(new Error('Firebase Auth not initialized'));
    return authInstance.createUserWithEmailAndPassword(email, password);
  }

  function signOutAdmin() {
    if (!authInstance) return Promise.resolve();
    return authInstance.signOut();
  }

  function onAuthStateChanged(callback) {
    if (authInstance) {
      return authInstance.onAuthStateChanged(callback);
    }
    // Fallback: check session storage
    const localAdmin = sessionStorage.getItem('doubledeezz_admin_auth') === 'true';
    callback(localAdmin ? { email: 'admin@doubledeezz.local', uid: 'local_admin' } : null);
    return () => {};
  }

  // =========================================================================
  // 3. REAL-TIME MENU, SETTINGS & ORDER LISTENERS
  // =========================================================================

  function subscribeToMenu(onUpdate, onError) {
    if (activeMenuUnsubscribe) {
      try { activeMenuUnsubscribe(); } catch (e) {}
      activeMenuUnsubscribe = null;
    }

    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        // Primary Firestore document: 'restaurant/menu'
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
            loadFallbackMenu(onUpdate);
          }, (err) => {
            console.warn('Firestore live listener warning, loading fallback:', err);
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

    // Fetch from server / local menu.json
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

  // =========================================================================
  // 4. CLOUD SAVE & FIRESTORE DATABASE SEEDING
  // =========================================================================

  async function saveMenuToCloud(menuData) {
    let cloudSaved = false;

    // 1. Firebase Firestore write
    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        await firestoreInstance.collection('restaurant').doc('menu').set(menuData, { merge: true });
        cloudSaved = true;
      } catch (e) {
        console.error('Failed saving menu to Firestore:', e);
      }
    }

    // 2. Local API write
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

    // 1. Firestore collection write
    if (isFirebaseConfigured() && firestoreInstance) {
      try {
        await firestoreInstance.collection('orders').doc(orderId).set(cleanOrder);
        orderSaved = true;
      } catch (e) {
        console.error('Firestore order write error:', e);
      }
    }

    // 2. Local API write
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
        await firestoreInstance.collection('orders').doc(orderId).update({
          status,
          updatedAt: new Date().toISOString()
        });
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

  // Seed Firestore with Complete Granular Structure:
  // 1. restaurant/menu
  // 2. restaurant/settings
  // 3. categories/{catId}
  // 4. menu_items/{itemId}
  async function seedFirestore(menuData) {
    if (!firestoreInstance) throw new Error('Firebase Firestore not initialized. Please configure credentials first.');

    // 1. Seed Main Menu document
    await firestoreInstance.collection('restaurant').doc('menu').set(menuData);

    // 2. Seed Settings document
    if (menuData._settings) {
      await firestoreInstance.collection('restaurant').doc('settings').set(menuData._settings);
    }

    // 3. Seed granular Categories collection
    const batch = firestoreInstance.batch();
    const categories = menuData._categories || [];
    categories.forEach(cat => {
      const catRef = firestoreInstance.collection('categories').doc(cat.id);
      batch.set(catRef, cat);
    });

    // 4. Seed granular Menu Items collection
    categories.forEach(cat => {
      const items = menuData[cat.id] || [];
      items.forEach(item => {
        const itemKey = item.id || (cat.id + '_' + item.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
        const itemRef = firestoreInstance.collection('menu_items').doc(itemKey);
        batch.set(itemRef, {
          ...item,
          category: cat.id,
          categoryName: cat.name,
          updatedAt: new Date().toISOString()
        });
      });
    });

    await batch.commit();
    console.log('✅ Cloud Firestore successfully seeded with all categories and menu items!');
    return true;
  }

  // Export to Global Window Object
  window.DoubleDeezzFirebase = {
    init: initFirebase,
    isConfigured: isFirebaseConfigured,
    getConfig: getEffectiveConfig,
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
    signInWithEmail,
    registerAdminAccount,
    signOutAdmin,
    onAuthStateChanged,
    subscribeToMenu,
    subscribeToSettings,
    subscribeToOrders,
    saveMenuToCloud,
    saveOrderToCloud,
    updateOrderStatus,
    saveSettings,
    seedFirestore
  };

  // Auto-init on load
  window.addEventListener('DOMContentLoaded', () => {
    initFirebase();
  });

})(window);
