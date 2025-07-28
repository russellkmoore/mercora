# Mercora - AI-Powered Outdoor Gear eCommerce Platform

> **Advanced eCommerce platform with integrated AI assistant, built on Cloudflare's edge infrastructure**

Mercora is a modern, AI-enhanced eCommerce platform specializing in outdoor gear. It features **Volt**, an intelligent AI shopping assistant that provides contextual product recommendations using semantic search and vector databases.

## 🗺️ Quick Navigation

| 📋 Documentation | 🔗 Link | 📝 Description |
|------------------|---------|----------------|
| **System Architecture** | [📐 Architecture Overview](/docs/architecture.md) | Complete system design, components, security |
| **AI Pipeline** | [🤖 AI Documentation](/docs/ai-pipeline.md) | Vector search, anti-hallucination, recommendations |
| **API Specifications** | [🔌 API Architecture](/docs/api-architecture.md) | Endpoints, security, integration flows |
| **Product Roadmap** | [🗺️ Development Roadmap](/ROADMAP.md) | Planned features, milestones, and progress |
| **Data Documentation** | [📊 Data Guide](/data/README.md) | Product data, knowledge base, data formats |
| **Live Demo** | [🌐 voltique.russellkmoore.me](https://voltique.russellkmoore.me) | Try the AI assistant and explore products |

## ✨ Key Features

### 🤖 **AI-Powered Shopping Assistant**
- **Volt AI Agent**: Conversational shopping assistant with personality
- **Semantic Product Search**: Vector-based product discovery using embeddings
- **Contextual Recommendations**: AI suggests relevant products based on user queries
- **Knowledge Base Integration**: AI-powered customer support with vectorized FAQ/policies

### 🛒 **Complete eCommerce Platform**
- **Product Catalog**: Dynamic categories with filtering and sorting
- **User Authentication**: Secure login/registration via Clerk
- **Shopping Cart**: Persistent cart with real-time updates
- **Checkout Flow**: Complete order processing with shipping/billing
- **Order Management**: User order history and status tracking

### ⚡ **Edge-Optimized Performance**
- **Cloudflare Workers**: Global edge deployment for sub-100ms response times
- **Cloudflare D1**: Distributed SQLite database for product/order data
- **Cloudflare R2**: Object storage for product images and content
- **Next.js 14**: Modern React framework with App Router

## 🏗️ Architecture

### **Tech Stack**
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Cloudflare Workers, OpenNext
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM
- **Storage**: Cloudflare R2 Object Storage
- **AI**: Cloudflare AI (Llama 3.1 8B, BGE embeddings)
- **Vector DB**: Cloudflare Vectorize
- **Auth**: Clerk Authentication
- **Payments**: Mock implementation (Stripe integration planned)

### **AI Infrastructure**
```
User Query → AI Embeddings → Vector Search → Context Retrieval → LLM Response + Products
```

- **Vector Database**: 38 indexed items (30 products + 8 knowledge articles)
- **Embedding Model**: BAAI BGE-base-en-v1.5 (768 dimensions)
- **Language Model**: Meta Llama 3.1 8B Instruct
- **Context Window**: Semantic search with top-K retrieval

## � Architecture Documentation

Comprehensive technical documentation with interactive Mermaid diagrams:

### **System Architecture**
- **[Complete Architecture Overview](/docs/architecture.md)** - High-level system design, component relationships, deployment pipeline, and security architecture
- **[AI Processing Pipeline](/docs/ai-pipeline.md)** - Detailed AI workflows, vector search deep-dive, anti-hallucination systems, and recommendation engine
- **[API Architecture](/docs/api-architecture.md)** - Complete API specifications, security models, and integration flows

### **Visual Documentation Features**
- 🎨 **Interactive Mermaid Diagrams** - View in GitHub, VS Code, or any Mermaid viewer
- 🔄 **Data Flow Visualizations** - From user input to AI recommendations
- 🏗️ **Component Architecture** - Frontend/backend relationship mapping
- 🔐 **Security Architecture** - Multi-layered protection strategies
- 📊 **Database Schema** - Complete ER diagrams with relationships
- 🚀 **Deployment Pipeline** - Build and deployment process flows

> **💡 Tip**: Open the documentation files in GitHub or VS Code with Mermaid extension for interactive diagram viewing.

## �🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm/yarn/pnpm
- Cloudflare account with Workers/D1/R2/AI enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/russellkmoore/mercora.git
   cd mercora
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create `.env.local`:
   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key

   # Cloudflare (handled via wrangler bindings in production)
   # These are configured in wrangler.jsonc for deployment
   ```

4. **Database Setup**
   ```bash
   # Initialize D1 database
   npx wrangler d1 create mercora-db
   
   # Run migrations
   npx wrangler d1 migrations apply mercora-db --local
   npx wrangler d1 migrations apply mercora-db
   ```

5. **Development Server**
   ```bash
   npm run dev
   ```
   
   Visit [http://localhost:3000](http://localhost:3000)

### **Production Deployment**

1. **Configure Cloudflare Bindings**
   Update `wrangler.jsonc` with your resource IDs:
   ```json
   {
     "bindings": [
       {
         "name": "DB",
         "type": "d1",
         "id": "your-d1-database-id"
       },
       {
         "name": "MEDIA",
         "type": "r2",
         "bucket_name": "your-r2-bucket"
       }
     ]
   }
   ```

2. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

## 🧠 AI Features Deep Dive

### **Volt AI Assistant**
Volt is Mercora's AI shopping assistant with a cheeky, knowledgeable personality. Key capabilities:

- **Product Expertise**: Deep knowledge of outdoor gear with contextual recommendations
- **Personality**: Witty, slightly sarcastic, but always helpful tone
- **User Personalization**: Integrates with Clerk for personalized greetings
- **Vector Context**: Uses semantic search to provide relevant product information

### **Vector Database Implementation**
- **Products**: 30 outdoor gear items indexed with descriptions, features, and metadata
- **Knowledge Base**: 8 support articles (returns, shipping, warranties, etc.)
- **Embedding Process**: Text → BGE embeddings → Vectorize storage
- **Query Flow**: User question → embedding → similarity search → context retrieval

### **AI Response Generation**
```typescript
// Simplified flow
const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text: question });
const context = await vectorize.query(embedding.data[0], { topK: 5 });
const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
  messages: [
    { role: "system", content: systemPrompt + context },
    { role: "user", content: question }
  ]
});
```

## 📁 Project Structure

```
mercora/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── agent-chat/           # AI chat endpoint
│   │   ├── vectorize-products/   # Product indexing
│   │   └── vectorize-knowledge/  # Knowledge base indexing
│   ├── category/[slug]/          # Category pages
│   ├── product/[slug]/           # Product detail pages
│   ├── checkout/                 # Checkout flow
│   └── orders/                   # Order history
├── components/                   # React Components
│   ├── agent/                    # AI chat components
│   │   ├── AgentDrawer.tsx       # Main chat interface
│   │   └── ProductCard.tsx       # AI-recommended products
│   ├── cart/                     # Shopping cart
│   ├── checkout/                 # Checkout forms
│   └── ui/                       # shadcn/ui components
├── lib/                          # Utilities & Logic
│   ├── db/                       # Database schema & connection
│   ├── models/                   # Data access layer
│   ├── stores/                   # Zustand state management
│   └── types/                    # TypeScript definitions
├── data/                         # Content & Data
│   ├── products_md/              # Product descriptions (vectorized)
│   └── knowledge_md/             # Support articles (vectorized)
└── migrations/                   # Database migrations
```

## 🛠️ Development

### **Key Commands**
```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm run deploy             # Deploy to Cloudflare

# Database
npm run db:generate        # Generate migrations
npm run db:migrate         # Apply migrations
npm run db:studio          # Database GUI

# AI/Vector Management
npm run vectorize:products    # Index products
npm run vectorize:knowledge   # Index knowledge base
```

### **Environment Variables**
```env
# Required for development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Production (handled via Cloudflare bindings)
# - DB (Cloudflare D1)
# - MEDIA (Cloudflare R2)
# - AI (Cloudflare AI)
# - VECTORIZE (Cloudflare Vectorize)
```

## 🔧 Configuration

### **Cloudflare Bindings (wrangler.jsonc)**
```json
{
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "bindings": [
    {
      "name": "DB",
      "type": "d1",
      "id": "your-d1-database-id"
    },
    {
      "name": "MEDIA", 
      "type": "r2",
      "bucket_name": "voltique-images"
    },
    {
      "name": "AI",
      "type": "ai"
    },
    {
      "name": "VECTORIZE",
      "type": "vectorize",
      "index_name": "voltique-index"
    }
  ]
}
```

### **Database Schema**
Core entities:
- **Products**: Catalog with pricing, inventory, images
- **Categories**: Product organization
- **Orders**: Complete order tracking
- **Users**: Integrated with Clerk authentication

## 🎯 AI Implementation Guide

### **Adding New Products to Vector Index**
1. Create markdown file in `data/products_md/`
2. Include product metadata (ID, name, description, features)
3. Run vectorization: `POST /api/vectorize-products`
4. Verify in Volt chat interface

### **Customizing Volt's Personality**
Edit the system prompt in `app/api/agent-chat/route.ts`:
```typescript
const systemPrompt = `You are Volt, a cheeky and opinionated outdoor gear expert...`
```

### **Vector Search Tuning**
Adjust relevance in vectorize query:
```typescript
const vectorResults = await vectorize.query(embedding.data[0], {
  topK: 5,        // Number of results
  returnMetadata: true
});
```

## 📈 Performance

- **Edge Deployment**: Sub-100ms response times globally
- **Vector Search**: ~50ms semantic similarity queries  
- **AI Generation**: ~2-3s for contextual responses
- **Image Optimization**: Cloudflare CDN with automatic WebP conversion
- **Database**: Distributed SQLite with sub-10ms queries

## 🔮 Roadmap

### **Immediate (Phase 1)**
- [ ] Stripe payment integration
- [ ] Enhanced AI prompt engineering
- [ ] Admin dashboard for content management

### **Near-term (Phase 2)**
- [ ] AI-powered search integration
- [ ] Product comparison features
- [ ] Advanced recommendation engine

### **Future (Phase 3)**
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Advanced analytics dashboard

## 🤝 Contributing

### **Development Guidelines**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Review the [architecture documentation](/docs) for system understanding
4. Make changes following the established patterns
5. Update relevant documentation and diagrams
6. Submit a pull request

### **Documentation Standards**

- **Code Documentation**: Follow the established JSDoc patterns
- **Architecture Changes**: Update Mermaid diagrams in `/docs`
- **API Changes**: Update API documentation accordingly

## 📚 Technical Documentation

For developers and technical stakeholders:

### **Complete Architecture Documentation**
- **[📐 System Architecture](/docs/architecture.md)** - Complete system overview with Mermaid diagrams
- **[🤖 AI Pipeline Documentation](/docs/ai-pipeline.md)** - Deep dive into AI processing workflows
- **[🔌 API Architecture](/docs/api-architecture.md)** - Comprehensive API specifications and flows

### **Key Technical Resources**
- **Interactive Diagrams**: View documentation in GitHub for interactive Mermaid diagrams
- **Code Documentation**: Comprehensive inline documentation throughout codebase
- **Database Schema**: Complete ER diagrams and relationship documentation
- **Security Model**: Multi-layered security architecture and threat mitigation

> **💡 Developer Tip**: Start with the [System Architecture](/docs/architecture.md) for a complete technical overview, then dive into specific areas as needed.

## 🤝 Contributing (Legacy)
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Cloudflare**: For the incredible edge platform and AI infrastructure
- **Clerk**: For seamless authentication
- **Next.js**: For the amazing developer experience
- **shadcn/ui**: For beautiful, accessible components

---

**Built with ❤️ for outdoor enthusiasts who love great gear and great technology.**
