# 🛍️ Mercora AI Agent Data Directory

This folder contains source data and scripts used to support the Mercora eCommerce AI assistant.

## Contents

- **`products.csv`**  
  The exported product catalog in CSV format. This includes data merged from D1 across multiple product-related tables.

- **`productsToMd.py`**  
  A Python script that reads `products.csv` and generates structured Markdown files (one per product) inside the `products_md/` folder.

- **`products_md/`**  
  Auto-generated Markdown files representing individual products. These are vectorized and used as a knowledge base for AI-powered search and chat.  
  ➤ **Upload this folder to R2 under the prefix**: `products_md/`

- **`knowledge_md/`**  
  Markdown documents covering FAQs and site knowledge (e.g. shipping, returns, warranty). These are embedded by the RAG agent for grounding chat answers.  
  ➤ **Upload this folder to R2 under the prefix**: `faq_md/` or `knowledge_md/`

## ⚙️ Usage Notes

- Both `products_md/` and `knowledge_md/` should be uploaded to your bound Cloudflare R2 bucket (e.g. `voltique-images`).
- After uploading, run the appropriate `/api/vectorize-*` endpoint (e.g. `/api/vectorize-products`, `/api/vectorize-faqs`) to embed the new content into your Cloudflare Vectorize index.
- You can update content at any time — just add new Markdown files to these folders and re-run the vectorization endpoints.

## 🧠 Agent Integration

The AI agent uses the vectorized content from these folders to:

- Answer user questions with grounded, accurate responses
- Recommend products based on embedded product context
- Retrieve knowledge base answers for site policies

> 📌 Keeping `products_md` and `knowledge_md` up to date ensures the assistant has current and relevant content to work with.