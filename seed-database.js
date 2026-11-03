const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyC2CUZYQvkXM1v73NPPj7TTMHi1guw3lXk",
  authDomain: "doubledeezz.firebaseapp.com",
  databaseURL: "https://doubledeezz-default-rtdb.firebaseio.com",
  projectId: "doubledeezz",
  storageBucket: "doubledeezz.firebasestorage.app",
  messagingSenderId: "647790444183",
  appId: "1:647790444183:web:e18cc4abf927ded7daf3d2",
  measurementId: "G-E3D0N7Z8GR"
};

const menuData = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu.json'), 'utf8'));

async function seedCompleteDatabase() {
  console.log('🚀 Seeding Live Firebase Database for Double Deezz...');

  const baseUrl = firebaseConfig.databaseURL;
  const keyParam = `?key=${firebaseConfig.apiKey}`;

  // 1. Seed Entire Menu
  try {
    const res = await fetch(`${baseUrl}/menu.json${keyParam}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menuData)
    });
    console.log(`✅ [1/3] Menu seeded successfully! Status: ${res.status}`);
  } catch (err) {
    console.error('Failed to seed menu:', err);
  }

  // 2. Seed Restaurant Settings
  try {
    const res = await fetch(`${baseUrl}/settings.json${keyParam}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menuData._settings || {})
    });
    console.log(`✅ [2/3] Settings seeded successfully! Status: ${res.status}`);
  } catch (err) {
    console.error('Failed to seed settings:', err);
  }

  // 3. Seed Categories
  try {
    const res = await fetch(`${baseUrl}/categories.json${keyParam}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menuData._categories || [])
    });
    console.log(`✅ [3/3] Categories seeded successfully! Status: ${res.status}`);
  } catch (err) {
    console.error('Failed to seed categories:', err);
  }

  console.log('\n🎉 Live Firebase Database is 100% seeded and active!');
}

seedCompleteDatabase();
