# Mercora - AI-Powered Outdoor Gear eCommerce

> **Advanced eCommerce platform with integrated AI assistant, built on Cloudflare's edge infrastructure**

Mercora is a modern, AI-enhanced eCommerce platform specializing in outdoor gear. It features **Volt**, an intelligent AI shopping assistant that provides contextual product recommendations using semantic search and vector databases.

**🌐 Live Demo**: [voltique.russellkmoore.me](https://voltique.russellkmoore.me)

## ✨ Key Features

### 🤖 AI-Powered Shopping Assistant
- **Volt AI Agent**: Conversational shopping assistant with personality
- **Semantic Product Search**: Vector-based product discovery using embeddings
- **Contextual Recommendations**: AI suggests relevant products based on user queries
- **Knowledge Base Integration**: AI-powered customer support with vectorized FAQ/policies

### 🛒 Complete eCommerce Platform
- **Product Catalog**: Dynamic categories with filtering and sorting
- **User Authentication**: Secure login/registration via Clerk
- **Shopping Cart**: Persistent cart with real-time updates
- **Stripe Integration**: Secure payments with real-time tax calculation
- **Discount System**: MACH Alliance-compliant promotional codes
- **Order Management**: Complete order history and status tracking

### ⚡ Edge-Optimized Performance
- **Cloudflare Workers**: Global edge deployment for sub-100ms response times
- **Cloudflare D1**: Distributed SQLite database for product/order data
- **Cloudflare R2**: Object storage for product images and content
- **Next.js 15**: Modern React framework with App Router

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
- **Language Model**: Meta Llama 3.1 8B Instruct
- **Context Window**: Semantic search with top-K retrieval

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
   npx wrangler d1 create mercora-db
   npx wrangler d1 migrations apply mercora-db --local
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 📚 Documentation

### **📋 Getting Started**
- **[🚀 Quick Start](#-quick-start)** - Get up and running locally
- **[🏗️ Complete Deployment Guide](docs/DEPLOYMENT_SETUP.md)** - Production deployment with all services
- **[🗺️ Development Roadmap](ROADMAP.md)** - Current status and planned features

### **🔧 Technical Documentation**
- **[📐 System Architecture](docs/architecture.md)** - Complete system design with interactive diagrams
- **[🤖 AI Pipeline](docs/ai-pipeline.md)** - Deep dive into AI processing workflows
- **[🔌 API Architecture](docs/api-architecture.md)** - Comprehensive API specifications and flows
- **[🔧 Claude AI Assistant Context](docs/CLAUDE.md)** - Development context for AI assistance

### **🛒 Business Features**
- **[💳 Stripe Integration](docs/STRIPE_INTEGRATION.md)** - Payment and tax calculation setup
- **[🎟️ Discount System](docs/CLAUDE.md#promotional-system)** - MACH Alliance promotional codes
- **[📊 Admin Dashboard](docs/admin-dashboard-specification.md)** - Administrative interface specification

### **🔮 Advanced Features**
- **[🌟 MCP Server](docs/mcp-server-specification.md)** - Model Context Protocol integration
- **[🔒 Security Documentation](docs/DEPLOYMENT_SETUP.md#-security-checklist)** - Security architecture and best practices

## 🎯 Development

### **Key Commands**
```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm run deploy             # Deploy to Cloudflare

# Database
npx wrangler d1 migrations apply mercora-db --local  # Local migrations
npx wrangler d1 migrations apply mercora-db          # Production migrations

# AI Content Management
curl -X POST localhost:3000/api/vectorize-products   # Index products
curl -X POST localhost:3000/api/vectorize-knowledge  # Index knowledge base
```

### **Project Structure**
```
mercora/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes (unified structure)
│   ├── checkout/             # Complete checkout flow
│   └── orders/               # Order management
├── components/               # React Components
│   ├── agent/                # AI chat components
│   ├── cart/                 # Shopping cart
│   ├── checkout/             # Stripe checkout integration
│   └── ui/                   # shadcn/ui components
├── lib/                      # Core Logic
│   ├── db/                   # Database schema & migrations
│   ├── models/               # Data access layer with MACH compliance
│   ├── stores/               # Zustand state management
│   ├── types/                # TypeScript definitions
│   └── stripe.ts             # Stripe configuration
├── data/                     # Content & Data
│   ├── products_md/          # Product descriptions (vectorized)
│   └── knowledge_md/         # Support articles (vectorized)
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

## 📈 Performance

- **🌍 Global Edge**: Sub-100ms response times worldwide
- **🔍 Vector Search**: ~50ms semantic similarity queries
- **🤖 AI Generation**: ~2-3s for contextual responses
- **📱 Core Web Vitals**: Optimized for mobile-first experience

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
- **Payment Security**: PCI-compliant Stripe integration with webhook verification
- **API Security**: Rate limiting, input validation, and SQL injection protection
- **Content Security**: CSP headers and XSS prevention

### **Data Protection**
- All secrets stored in Cloudflare encrypted storage
- No sensitive data in client-side code
- GDPR-compliant data handling practices

## 📊 Current Status

### **✅ Production Ready**
- Complete eCommerce platform with AI assistant
- Stripe payment integration with real-time tax calculation
- Advanced personalization and recommendation system
- Comprehensive documentation and deployment guides

### **🚀 Next Phase**
- Admin dashboard for content management
- Enhanced AI capabilities and MCP integration
- Advanced analytics and business intelligence
- Multi-language and international expansion

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