# Double Deezz The Food Cafe | QR Menu & Online Ordering System

Artisanal live grill, handcrafted burgers, stone-baked pizzas, wraps, mojitos & cafe dining web application for **Double Deezz The Food Cafe, Phagwara**.

## 🎨 Brand & Color System
* **Deep Burgundy (`#861B40`)**: Primary brand color, headers, non-veg accents, buttons.
* **Fresh Green (`#26966F`)**: Veg indicator, cart checkout pills, delivery accents.
* **Warm Cream (`#FFF8E9`) & Cream Dark (`#F5ECD5`)**: Cafe aesthetic background and surface highlights.
* **Dark Slate (`#242424`)**: High-contrast typography.

## 🌟 Key Features
- 📱 **Mobile-First QR Dining Experience**: Optimized for smartphones scanning on-table QR codes or home delivery ordering.
- 🍔 **Complete 22-Category Menu**:
  - Veg Burgers, Veg Sandwiches, Veg Wraps, Salads, Noodles, Veg Marine, Mojitos.
  - Non-Veg Burgers, Non-Veg Sandwiches, Non-Veg Wraps, Fried Items, Veg Snacks, Non-Veg Snacks, Extra Dips, Non-Veg Marine.
  - Veg Pizzas (16 varieties) & Non-Veg Pizzas (5 varieties) with Small, Medium, and Large portion selectors.
  - Pizza Add-ons (Cheese Burst Topping, Extra Topping) with dynamic size pricing.
  - Rice Bowls, Veg Pasta, Non-Veg Pasta, Garlic Bread, Cheese Chilli.
- 🌿 **Clear Dietary Indicators**: FSSAI-standard Veg (green circle) and Non-Veg (burgundy triangle) badges on all items.
- 🛒 **Interactive Tray & Sticky Bottom Cart**: Real-time quantity steppers, add-on customizers, portion selectors, and instant totals.
- 🛵 **Delivery Policy Engine**: Free home delivery up to 3 KM (minimum order ₹300) with dynamic notification alerts.
- 📲 **Professional WhatsApp Ordering**: Automatically generates formatted WhatsApp order messages routed directly to the cafe's ordering number (+91 87288 67122).
- 🔒 **Dedicated Admin Portal (`/admin`)**:
  - Passcode-protected management (`1818`).
  - Real-time Dashboard with dish counts, category stats, and incoming orders feed.
  - Menu Manager (Add dish, edit, delete with confirmation, instant in-stock/out-of-stock toggle).
  - Fast Bulk Price Editor for regular dishes and Small/Medium/Large pizza prices.
  - Restaurant Settings editor (phone numbers, WhatsApp digits, minimum order, delivery radius, policy).
  - Firebase Cloud Sync and One-Click Database Seeding.
- ⚡ **Firebase & Cloud Firestore**: Real-time cloud sync across customer phones using Firebase SDK with seamless local fallback.

## 🚀 Local Development
```bash
# 1. Install dependencies (Node.js built-in modules used)
npm start
# or
node server.js
```
* **Customer Website**: [http://localhost:3000](http://localhost:3000)
* **Admin Portal**: [http://localhost:3000/admin](http://localhost:3000/admin) *(Passcode: `1818`)*

## 🌐 Deployment

### GitHub Pages
1. Go to repository **Settings** > **Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then click **Save**.
4. The live site will be deployed at `https://<username>.github.io/<repo>/`.

### Vercel
The project includes a ready-to-deploy `vercel.json` serverless configuration. Deploy instantly via:
```bash
vercel --prod
```

## 📞 Contact & Support
* **Primary Phone / WhatsApp**: +91 87288 67122
* **Secondary Contact**: +91 98553 81984
* **Location**: Phagwara, Punjab
