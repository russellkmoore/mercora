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
- Finalize styling and responsiveness of sort toggles
- Add mini cart drawer (design and functionality)
- Add `ROADMAP.md`
- refactor model and types defintions.

## 🟧 In Progress / Immediate Tasks

### UI/UX
- [ ] Add dynamic recommendations section (initially static)
- [ ] Improve product description UX (truncate + expand)

### Product Data
- [ ] Fill in real product descriptions
- [ ] Standardize image naming / alt text for SEO

### Dev/Docs
- [ ] Create `README.md` with setup and deploy instructions
- [ ] Document schema, media management, and deployment steps

---

## 🟥 Phase 1 – MVP Must Haves

### EPIC 1: Authentication
- [ ] Add user authentication (Clerk or Auth.js)
- [ ] Create user profile pages
- [ ] Middleware for protected routes
- [ ] Role-based access (admin vs. customer)

### EPIC 2: Checkout
- [ ] Checkout flow (shipping, billing, confirmation)
- [ ] Convert cart to order + clear cart

---

## 🟨 Phase 2 – Payments & Orders

### EPIC 3: Payment Integration
- [ ] Integrate Stripe (Cloudflare compatible)
- [ ] Support for 3D Secure and webhooks
- [ ] Secure token handling

### EPIC 4: Order Management
- [ ] Orders schema (orders + items)
- [ ] Inventory deduction + stock handling
- [ ] User order history + status tracking

---

## 🟩 Phase 3 – Admin & Operations

### EPIC 5: Admin Dashboard
- [ ] Admin auth + roles
- [ ] Product + inventory CRUD
- [ ] Order management panel
- [ ] Image uploads to R2

### EPIC 6: Search & Filtering
- [ ] D1-based full-text search
- [ ] Search bar UI
- [ ] Faceted filters by price, category, availability

---

## 🟦 Phase 4 – UX Enhancements

### EPIC 7: Email & Notifications
- [ ] Order confirmation, shipping, reset emails
- [ ] Email queue with retry + tracking

### EPIC 8: Shipping & Taxes
- [ ] Schema for shipping zones + rates
- [ ] Tax calculation by region

### EPIC 9: Reviews & Ratings
- [ ] Schema + moderation
- [ ] UI for submitting and viewing reviews

---

## 🟪 Phase 5 – AI & Intelligence

### EPIC 10: AI Foundations
- [ ] Set up vector database 
- [ ] Index product descriptions
- [ ] Create AI Worker or function to handle queries

### EPIC 11: AI Assistant & Recommendations
- [ ] AI Chat assistant with product-aware answers
- [ ] Parse AI response → chat text + product references
- [ ] Display product mini-cards in response
- [ ] Track feedback on recommendations

### EPIC 12: AI Search
- [ ] Natural language search support
- [ ] Blend AI + keyword results
- [ ] Suggest similar products dynamically
