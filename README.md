# Mercora - AI-Powered Outdoor Gear eCommerce

> **Production-ready eCommerce platform with advanced AI assistant and comprehensive admin dashboard**

Mercora is a sophisticated, AI-enhanced eCommerce platform specializing in outdoor gear. Built on Cloudflare's edge infrastructure, it features **Volt**, an intelligent AI shopping assistant with semantic search, personalization, and vector-based product recommendations.

**🌐 Live Demo**: [voltique.russellkmoore.me](https://voltique.russellkmoore.me)  
**🚀 Status**: Production-ready with full admin dashboard and AI analytics

## ✨ Key Features

### 🤖 AI-Powered Shopping Assistant
- **Volt AI Agent**: Conversational shopping assistant with personality and expertise
- **Semantic Search**: Vector-based product discovery using BGE embeddings (768 dimensions)
- **Contextual Recommendations**: AI suggests products based on user queries and history
- **Knowledge Base Integration**: AI-powered customer support with vectorized FAQ/policies
- **Anti-Hallucination**: Strict guardrails prevent fake product recommendations
- **Personalization**: VIP customer recognition and tailored experiences

### 🛒 Complete eCommerce Platform
- **Product Catalog**: Dynamic categories with filtering, sorting, and search
- **User Authentication**: Secure login/registration via Clerk
- **Shopping Cart**: Persistent cart with real-time updates
- **Stripe Integration**: Secure payments with real-time tax calculation
- **Discount System**: MACH Alliance-compliant promotional codes with stacking
- **Order Management**: Complete order history, tracking, and status updates

### 👨‍💼 Comprehensive Admin Dashboard
- **Product Management**: CRUD operations, bulk editing, inventory tracking
- **Order Management**: Order processing, status updates, customer communication
- **AI Analytics**: Real-time business intelligence with natural language insights
- **Customer Management**: VIP identification, order history, personalization
- **Settings Management**: Store configuration, AI tuning, system monitoring
- **🔐 Secure Authentication**: Multi-layered admin access control with Clerk integration

### ⚡ Edge-Optimized Performance
- **Cloudflare Workers**: Global edge deployment for sub-100ms response times
- **Cloudflare D1**: Distributed SQLite database with Drizzle ORM
- **Cloudflare R2**: Object storage for product images and content
- **Cloudflare Vectorize**: 38-item vector index for semantic search
- **Next.js 15**: Modern React framework with App Router and TypeScript

## 🏗️ Architecture

### **Tech Stack**
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Cloudflare Workers with OpenNext
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Storage**: Cloudflare R2 Object Storage
- **AI**: Cloudflare AI (Llama 3.1 8B, BGE embeddings)
- **Vector DB**: Cloudflare Vectorize
- **Auth**: Clerk Authentication
- **Payments**: Stripe with Stripe Tax

### **AI Infrastructure**
```
User Query → AI Embeddings → Vector Search → Context Retrieval → LLM Response + Products
```

- **Vector Database**: 38 indexed items (30 products + 8 knowledge articles)
- **Embedding Model**: BAAI BGE-base-en-v1.5 (768 dimensions)
- **Language Model**: Meta Llama 3.1 8B Instruct (temperature 0.3 for accuracy)
- **Context Window**: Semantic search with top-K retrieval and context limits
- **Admin Analytics**: AI-powered business intelligence with natural language insights

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- Cloudflare account with Workers paid plan
- Clerk account (for authentication)
- Stripe account (for payments)

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/russellkmoore/mercora.git
   cd mercora
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Add your Clerk and Stripe keys
   ```

3. **Database Setup**
   ```bash
   # Create the database (first time only)
   npx wrangler d1 create mercora-db
   
   # Update wrangler.jsonc with the database ID from the output above
   # Copy the database ID and update the "database_id" field in the d1_databases section
   
   # Apply schema migrations
   npx wrangler d1 migrations apply mercora-db --local     # Local development
   npx wrangler d1 migrations apply mercora-db --remote    # Remote production

   # Load sample data (optional)
   npx wrangler d1 execute mercora-db --local --file=data/d1/seed.sql   # Local
   npx wrangler d1 execute mercora-db --remote --file=data/d1/seed.sql  # Remote
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 📚 Documentation

### **🚀 Getting Started**
- **[⚡ Quick Start](#-quick-start)** - Get up and running locally
- **[🚀 Production Deployment](docs/DEPLOYMENT_SETUP.md)** - Complete deployment with all services
- **[🗺️ Development Roadmap](docs/ROADMAP.md)** - Current status and upcoming features

### **🔧 Technical Documentation**  
- **[🏗️ System Architecture](docs/architecture.md)** - Complete system design with diagrams
- **[🤖 AI Processing Pipeline](docs/ai-pipeline.md)** - Deep dive into AI workflows and anti-hallucination
- **[🔌 API Architecture](docs/api-architecture.md)** - RESTful API specifications and flows
- **[🔧 Development Context](docs/CLAUDE.md)** - Essential context for developers and AI assistants

### **💼 Business & Admin Features**
- **[👨‍💼 Admin Dashboard](docs/admin-dashboard-specification.md)** - Complete admin interface specification
- **[🔐 Admin Authentication](docs/admin-authentication.md)** - Comprehensive admin security and access control
- **[💳 Stripe Integration](docs/STRIPE_INTEGRATION.md)** - Payment processing and tax calculation
- **[🌟 MCP Server Integration](docs/mcp-server-specification.md)** - Revolutionary shopping through developer tools

## 🎯 Development

### **Key Commands**
```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm run deploy             # Deploy to Cloudflare

# Database
npx wrangler d1 migrations apply mercora-db --local    # Apply schema migrations (local)
npx wrangler d1 migrations apply mercora-db            # Apply schema migrations (production)
npx wrangler d1 execute mercora-db --local --file=data/d1/seed.sql  # Load sample data (local)

# AI Content Management (Development Mode - Auth Disabled)
curl -X GET "localhost:3000/api/admin/vectorize"  # Index products + knowledge (consolidated)
```

### **Project Structure**
```
mercora/
├── app/                      # Next.js App Router
│   ├── admin/                # Admin dashboard interface
│   ├── api/                  # API Routes (unified structure)
│   ├── checkout/             # Complete checkout flow
│   └── orders/               # Order management
├── components/               # React Components
│   ├── admin/                # Admin dashboard components
│   ├── agent/                # AI chat components
│   ├── cart/                 # Shopping cart
│   ├── checkout/             # Stripe checkout integration
│   └── ui/                   # shadcn/ui components
├── lib/                      # Core Logic
│   ├── db/                   # Database schema & migrations
│   ├── models/               # Data access layer with MACH compliance
│   ├── auth/                 # Authentication & authorization
│   ├── stores/               # Zustand state management
│   ├── types/                # TypeScript definitions
│   └── stripe.ts             # Stripe configuration
├── data/                     # Content & Data
│   ├── d1/                   # D1 Database files
│   │   └── seed.sql          # Database seed data
│   └── r2/                   # R2 Object Storage files
│       ├── categories/       # Category images
│       ├── products/         # Product images
│       ├── products_md/      # Product descriptions (vectorized)
│       └── knowledge_md/     # Support articles (vectorized)
└── docs/                     # Comprehensive documentation
```

## 🎪 Demo Features

### **🎟️ Demo Discount Codes**
Test the promotional system with these codes:

| Code | Type | Description |
|------|------|-------------|
| **SAVE20** | 20% off | $50+ minimum |
| **FREESHIP** | Free shipping | Any order |
| **10OFF** | $10 off | No minimum |
| **TOOLS30** | 30% off tools | Tools category only |
| **VIP25** | 25% off VIP | $100+ minimum |

### **💳 Test Payment Cards**
- **Success**: `4242424242424242`
- **Decline**: `4000000000000002`
- **3D Secure**: `4000002500003155`

## 📈 Performance & Capabilities

### **🌍 Global Performance**
- **Edge Response Times**: Sub-100ms worldwide via Cloudflare Workers
- **Vector Search Speed**: ~50ms semantic similarity queries  
- **AI Response Time**: ~2-3s for contextual responses with Llama 3.1
- **Database Queries**: ~10-20ms with D1 distributed SQLite
- **Core Web Vitals**: Mobile-optimized with 95+ Lighthouse scores

### **🎯 Current Scale**
- **Vector Index**: 38 items (30 products + 8 knowledge articles)
- **AI Context**: 768-dimension embeddings with BGE model
- **Admin Dashboard**: Full CRUD operations with real-time analytics
- **Order Processing**: Complete workflow from cart to fulfillment
- **Payment Processing**: Production-ready Stripe integration with tax calculation

## 🤝 Contributing

### **Development Guidelines**
1. Review the [architecture documentation](docs/architecture.md)
2. Follow established patterns and code style
3. Update relevant documentation for changes
4. Test thoroughly before submitting PRs

### **Documentation Standards**
- Keep code documentation up to date
- Update Mermaid diagrams for architecture changes
- Maintain API documentation accuracy

## 🔐 Security

### **Security Features**
- **Multi-layered Authentication**: Clerk integration with secure session management
- **Admin Access Control**: Role-based admin authentication with dev/production modes
- **API Protection**: Comprehensive admin API security with token authentication
- **Payment Security**: PCI-compliant Stripe integration with webhook verification
- **Route Protection**: Client-side and server-side admin route protection
- **Content Security**: CSP headers and XSS prevention

### **Data Protection**
- All secrets stored in Cloudflare encrypted storage
- No sensitive data in client-side code
- GDPR-compliant data handling practices

## 🚀 Current Status

### **✅ Production-Ready Features**
- **Complete eCommerce Platform**: Product catalog, cart, checkout, order management
- **AI Shopping Assistant**: Volt with semantic search and personalization
- **Payment Processing**: Full Stripe integration with real-time tax calculation
- **Admin Dashboard**: Product management, order processing, AI analytics
- **Edge Infrastructure**: Global deployment on Cloudflare with 99.9% uptime
- **Comprehensive Documentation**: Complete setup guides and technical specs

### **🎯 Recent Achievements** 
- ✅ **Admin Dashboard**: Complete admin interface with AI-powered analytics
- ✅ **Order Management**: Full order processing workflow with status tracking
- ✅ **AI Analytics**: Real-time business intelligence with natural language insights
- ✅ **Authentication System**: Comprehensive admin authentication with role-based access control
- ✅ **Customer Management**: VIP identification and personalized experiences

### **🔮 Next Phase**
- **MCP Server Integration**: Revolutionary shopping through developer tools
- **Advanced Personalization**: Enhanced AI recommendations and customer insights
- **Email Notifications**: Transactional email system for order updates
- **Mobile App**: Progressive Web App with offline capabilities

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Cloudflare**: For the incredible edge platform and AI infrastructure
- **Clerk**: For seamless authentication
- **Stripe**: For robust payment and tax solutions
- **Next.js**: For the amazing developer experience
- **shadcn/ui**: For beautiful, accessible components

---

**Built with ❤️ for outdoor enthusiasts who love great gear and great technology.**

**💡 Ready to explore? Visit the [live demo](https://voltique.russellkmoore.me) and chat with Volt!**