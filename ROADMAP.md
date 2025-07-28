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
- **AI Foundations Complete**: Vector database (Cloudflare Vectorize) setup
- **AI Product Indexing**: 30 products + 8 knowledge articles vectorized
- **AI Chat Assistant**: Volt personality with product-aware responses
- **AI Context Retrieval**: Semantic search with vectorized knowledge base
- **Product Recommendations**: AI returns contextual product suggestions
- **Chat UI**: Enhanced drawer with auto-scroll, loading states, user 
personalization
- Create `README.md` with setup and deploy instructions
- Document schema, media management, and deployment steps

## 🟧 In Progress / Immediate Tasks

### AI/UX Polish
- [ ] Fine-tune AI prompt engineering (reduce hallucinations, improve responses)
- [ ] Add AI response formatting improvements
- [ ] Fix Safari password manager detection on chat input
- [ ] Improve AI agent drawer width and animation timing


---

## 🟥 Phase 1 – MVP Must Haves
(done)
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

### ✅ EPIC 10: AI Foundations (COMPLETED)
- [x] Set up vector database (Cloudflare Vectorize)
- [x] Index product descriptions (30 products vectorized)
- [x] Index knowledge base (8 articles vectorized)
- [x] Create AI Worker functions to handle queries

### ✅ EPIC 11: AI Assistant & Recommendations (COMPLETED)
- [x] AI Chat assistant with product-aware answers (Volt personality)
- [x] Parse AI response → chat text + product references
- [x] Display product mini-cards in response
- [x] User personalization with Clerk integration
- [x] Enhanced chat UI with auto-scroll and loading states
- [ ] Track feedback on recommendations

### EPIC 12: AI Search (PARTIALLY COMPLETE)
- [x] Natural language search support (via AI chat)
- [x] Blend AI + keyword results in main search
- [ ] Suggest similar products dynamically on product pages

### EPIC 13: AI Enhancements
- [ ] Improve vectorization with better product metadata
- [ ] Add conversation memory across sessions
- [ ] Implement AI-powered product comparison
- [ ] Add AI-generated product recommendations on category/product pages

---

## 🎯 Recent Major Achievements

**AI-Powered eCommerce Assistant (Phase 5 - Mostly Complete!)**
- ✅ **Voltique AI Agent**: Fully functional AI assistant with personality
- ✅ **Vector Search**: Semantic product and knowledge retrieval 
- ✅ **Contextual Recommendations**: AI suggests relevant products based on user queries
- ✅ **Enhanced UX**: Wide drawer, auto-scroll, loading states, user personalization
- ✅ **Production Ready**: Deployed with proper error handling and fallbacks

**Key Technical Integrations:**
- Cloudflare AI (Llama 3.1 8B + BGE embeddings)
- Cloudflare Vectorize (38 indexed items)
- Cloudflare R2 (markdown storage)
- Clerk Authentication (user personalization)

## 🚀 Next Priority Areas

1. **AI Polish** - Fine-tune responses, reduce hallucinations
2. **Payment Integration** - Add Stripe for real transactions  
3. **Admin Dashboard** - Content management capabilities
4. **Search Enhancement** - Blend AI with traditional search 

