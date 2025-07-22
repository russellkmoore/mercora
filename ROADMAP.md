# Mercora eCommerce Platform – Development Roadmap

## ✅ Completed Core Features
- Product catalog with categories and images
- Product detail pages with pricing and inventory
- Category browsing with sorting
- Product cards and alt image support
- Edge-optimized deployment with Cloudflare Workers
- Cloudflare R2 integration for media
- D1-based product and category schema
- Server-side rendering with Next.js

## 🟧 In Progress / Immediate Next Tasks

### UI/UX
- [ ] Finalize styling and responsiveness of sort toggles
- [ ] Add mini cart drawer (design and functionality)
- [ ] Add dynamic recommendations section ("You May Also Like")
- [ ] Improve product description UX (truncate + expand)

### Product Data
- [ ] Fill in real product descriptions
- [ ] Standardize image naming / alt text for SEO
- [ ] Begin tagging products for AI-based recommendations

### Dev/Docs
- [ ] Add `ROADMAP.md` and keep it updated
- [ ] Create `README.md` for project setup and deploy
- [ ] Document product schema and R2 upload guidelines
- [ ] Add local dev + deploy instructions
- [ ] Add CONTRIBUTING.md (for future public collaboration)

---

## 🟥 Phase 1 – MVP Must Haves

### 🧾 EPIC: Authentication
- [ ] Add user authentication (Clerk or Auth.js)
- [ ] Create user profile pages
- [ ] Middleware for protected routes
- [ ] Role-based access (admin vs. customer)

### 🛒 EPIC: Shopping Cart & Checkout
- [ ] Cart schema and persistence (local + server)
- [ ] Cart drawer UI
- [ ] Quantity update / remove item support
- [ ] Checkout form (shipping + billing)
- [ ] Convert cart to order + order confirmation

---

## 🟨 Phase 2 – Payments & Orders

### 💳 EPIC: Payment Integration
- [ ] Integrate Stripe (via Cloudflare-compatible SDK)
- [ ] Handle payment intents, 3DS, webhooks
- [ ] Store minimal tokens, PCI-safe

### 📦 EPIC: Order Management
- [ ] Orders schema (orders + order items)
- [ ] Inventory decrement on order
- [ ] Order status tracking
- [ ] User order history UI

---

## 🟩 Phase 3 – Admin & Ops

### 🛠️ EPIC: Admin Dashboard
- [ ] Admin auth & role management
- [ ] Product + inventory CRUD
- [ ] Upload images to R2
- [ ] Order management

### 🔍 EPIC: Search & Filtering
- [ ] Full-text search with D1
- [ ] Add search bar UI
- [ ] Faceted filters on categories

---

## 🟦 Phase 4 – UX Enhancements

### ✉️ Email System
- [ ] Setup with Resend or SendGrid
- [ ] Order confirmation, password reset, etc.

### 🚚 Shipping & Taxes
- [ ] Shipping schema
- [ ] Tax rules by location
- [ ] (Optional) API-based real-time rates

### 🌟 Reviews & Ratings
- [ ] Schema for reviews
- [ ] Review form + star rating UI
- [ ] Admin moderation

---

## 🟪 Phase 5 – Growth & AI

### 📊 Analytics
- [ ] Sales + traffic tracking
- [ ] Popular product metrics
- [ ] Export reports

### 🧠 AI Integration (Experimental)
- [ ] Feed product descriptions into vector DB
- [ ] Enable AI search + recommendations
- [ ] Chat UI for natural product discovery

---

## Success Metrics
- MVP = Auth + cart + checkout complete
- Phase 2 = Orders + payments live
- Phase 3+ = Admin management and UX enhancements

---