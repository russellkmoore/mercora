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
- Fill in real product descriptions
- Improve product description UX (truncate + expand)
- Add user authentication (Clerk)
- Checkout flow (shipping, billing, confirmation)
- Orders schema (orders + items)
- Convert cart to order + clear cart
- order history for logged in users.
- User order history + status tracking

## 🟧 In Progress / Immediate Tasks

### UI/UX

### Product Data

- [ ] Standardize image naming / alt text for SEO

### Dev/Docs
- [ ] Create `README.md` with setup and deploy instructions
- [ ] Document schema, media management, and deployment steps

---

## 🟥 Phase 1 – MVP Must Haves

### EPIC 1: Authentication
(done))

### EPIC 2: Checkout
(done))

---

## 🟨 Phase 2 – Payments & Orders

### EPIC 3: Payment Integration
Current - mock checkout, throws away payment details.
- [ ] Integrate Stripe (Cloudflare compatible)
- [ ] Support for 3D Secure and webhooks
- [ ] Secure token handling

### EPIC 4: Order Management
- [ ] Inventory deduction + stock handling

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

### EPIC 13: AI Recommendations
- [ ] Add dynamic recommendations section (initially static) -- 

