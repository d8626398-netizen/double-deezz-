const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = __dirname;
const MENU_FILE = path.join(PUBLIC_DIR, 'menu.json');
const ORDERS_FILE = path.join(PUBLIC_DIR, 'orders.json');

// Ensure orders.json exists
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = (req.url || '/').split('?')[0];

  // API: Get Menu
  if (urlPath === '/api/menu' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(MENU_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read menu data' }));
    }
    return;
  }

  // API: Save Menu (Admin)
  if ((urlPath === '/api/menu' || urlPath === '/api/menu/save') && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const payload = await readBody(req);
      if (!payload || typeof payload !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid menu data payload' }));
        return;
      }
      fs.writeFileSync(MENU_FILE, JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Menu saved successfully' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to save menu data' }));
    }
    return;
  }

  // API: Get Settings
  if (urlPath === '/api/settings' && req.method === 'GET') {
    try {
      const menuData = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(menuData._settings || {}));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read settings' }));
    }
    return;
  }

  // API: Update Settings
  if (urlPath === '/api/settings' && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const payload = await readBody(req);
      const menuData = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
      menuData._settings = { ...menuData._settings, ...payload };
      fs.writeFileSync(MENU_FILE, JSON.stringify(menuData, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settings: menuData._settings }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to update settings' }));
    }
    return;
  }

  // API: Get Orders
  if (urlPath === '/api/orders' && req.method === 'GET') {
    try {
      const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8') || '[]');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(orders));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // API: Record New Order
  if (urlPath === '/api/orders' && req.method === 'POST') {
    try {
      const order = await readBody(req);
      const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8') || '[]');
      order.id = order.id || 'DD-' + Date.now().toString(36).toUpperCase();
      order.timestamp = order.timestamp || new Date().toISOString();
      order.status = order.status || 'Pending';
      orders.unshift(order);
      // Keep last 200 orders locally
      if (orders.length > 200) orders.length = 200;
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, orderId: order.id, order }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to save order' }));
    }
    return;
  }

  // API: Update Order Status
  if (urlPath === '/api/orders/status' && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const { orderId, status } = await readBody(req);
      const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8') || '[]');
      const target = orders.find(o => o.id === orderId);
      if (target) {
        target.status = status;
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, order: target }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Order not found' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to update order status' }));
    }
    return;
  }

  // API: Server-side Order and Add-on Validation
  if (urlPath === '/api/validate-order' && req.method === 'POST') {
    try {
      const payload = await readBody(req);
      const items = payload.items || [];
      const menuData = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
      const addonsConfig = menuData._addons || [];
      const addonsMap = {};
      addonsConfig.forEach(a => { addonsMap[a.id] = a; });

      let calculatedTotal = 0;
      const now = Date.now();

      for (const it of items) {
        const cat = it.category;
        const catItems = menuData[cat] || [];
        const found = catItems.find(x => x.name === it.name || x.id === it.id);

        if (!found) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, error: `Dish "${it.name}" was not found in ${cat}.` }));
          return;
        }

        // Check availability
        if (found.status === 'unavailable') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, error: `"${found.name}" is currently unavailable.` }));
          return;
        }

        // Compute item base price
        let basePrice = found.price || 0;
        if (found.variants && it.variantLabel) {
          const v = found.variants.find(vx => vx.label === it.variantLabel);
          if (v) basePrice = v.price;
        }

        // Validate add-ons
        let addonsSum = 0;
        if (Array.isArray(it.addons)) {
          for (const add of it.addons) {
            const cfg = addonsMap[add.id];
            if (!cfg || cfg.enabled === false) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ valid: false, error: `Add-on "${add.name || add.id}" is not available.` }));
              return;
            }
            let addPrice = cfg.price || 0;
            if (cfg.sizePricing && it.variantLabel && cfg.sizePricing[it.variantLabel]) {
              addPrice = cfg.sizePricing[it.variantLabel];
            }
            const addQty = Math.max(1, Number(add.qty) || 1);
            addonsSum += (addPrice * addQty);
          }
        }

        const lineUnitPrice = basePrice + addonsSum;
        const lineQty = Math.max(1, Number(it.qty) || 1);
        calculatedTotal += (lineUnitPrice * lineQty);
      }

      // Check delivery policy
      const settings = menuData._settings || {};
      const minOrder = settings.minOrderAmount || 300;
      const isDelivery = payload.orderType === 'Delivery';
      let deliveryCharge = 0;

      if (isDelivery) {
        const radius = Number(payload.distanceKm) || 2; // default within 3km
        if (radius <= (settings.freeDeliveryRadiusKm || 3)) {
          deliveryCharge = 0;
        } else {
          deliveryCharge = (settings.baseDeliveryCharge || 0) + ((radius - (settings.freeDeliveryRadiusKm || 3)) * 20);
        }
      }

      const grandTotal = calculatedTotal + deliveryCharge;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        valid: true,
        subtotal: calculatedTotal,
        deliveryCharge,
        grandTotal,
        minOrder,
        verifiedAt: now
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, error: 'Invalid order payload' }));
    }
    return;
  }

  // Routing for Admin Portal
  let safePath = decodeURI(urlPath);
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  } else if (safePath === '/admin' || safePath === '/admin/') {
    safePath = '/admin.html';
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

module.exports = handler;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(handler);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  Double Deezz The Food Cafe Server Running!`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`  Admin URL: http://localhost:${PORT}/admin`);
    console.log(`========================================\n`);
  });
}
