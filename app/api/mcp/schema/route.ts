import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // MCP Server Schema Documentation
  const schema = {
    name: "mercora-mcp-server",
    version: "1.0.0",
    description: "Mercora MCP server for agent-assisted commerce",
    capabilities: {
      tools: true,
      resources: false,
      prompts: false
    },
    tools: [
      {
        name: "search_products",
        description: "Search for products with agent context and user preferences",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query for products" },
            options: {
              type: "object",
              properties: {
                category: { type: "string" },
                priceMin: { type: "number" },
                priceMax: { type: "number" },
                limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
                sortBy: { type: "string", enum: ["price"] }
              }
            },
            session_id: { type: "string", description: "Agent session ID" }
          },
          required: ["query"]
        }
      },
      {
        name: "assess_request",
        description: "Assess fulfillment capability for multi-site coordination",
        inputSchema: {
          type: "object",
          properties: {
            requirements: {
              type: "object",
              properties: {
                items: { type: "array", minItems: 1, maxItems: 20, items: { type: "string" } },
                budget: { type: "number" },
                timeline: { type: "string" },
                location: { type: "string" }
              },
              required: ["items", "budget"]
            },
            session_id: { type: "string" }
          },
          required: ["requirements"]
        }
      },
      {
        name: "get_recommendations",
        description: "Get AI-powered product recommendations with agent context",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "object",
              properties: {
                currentProduct: { type: "number" },
                userActivity: { type: "string" },
                budget: { type: "number" },
                useCase: { type: "string" }
              }
            },
            session_id: { type: "string" }
          }
        }
      },
      {
        name: "add_to_cart",
        description: "Add single item to agent session cart",
        inputSchema: {
          type: "object",
          properties: {
            productId: { type: "number" },
            variantId: { type: "number" },
            quantity: { type: "number", default: 1 },
            session_id: { type: "string" }
          },
          required: ["productId", "variantId", "session_id"]
        }
      },
      {
        name: "bulk_add_to_cart",
        description: "Add multiple items to cart in single operation - key for agent efficiency",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { type: "number" },
                  variantId: { type: "number" },
                  quantity: { type: "number", default: 1 }
                },
                required: ["productId", "variantId"]
              }
            },
            session_id: { type: "string" }
          },
          required: ["items", "session_id"]
        }
      },
      {
        name: "update_cart",
        description: "Update cart item quantity",
        inputSchema: {
          type: "object",
          properties: {
            variantId: { type: "number" },
            quantity: { type: "number" },
            session_id: { type: "string" }
          },
          required: ["variantId", "quantity", "session_id"]
        }
      },
      {
        name: "remove_from_cart",
        description: "Remove item from cart",
        inputSchema: {
          type: "object",
          properties: {
            variantId: { type: "number" },
            session_id: { type: "string" }
          },
          required: ["variantId", "session_id"]
        }
      },
      {
        name: "clear_cart",
        description: "Clear entire cart - useful for starting fresh agent sessions",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" }
          },
          required: ["session_id"]
        }
      },
      {
        name: "get_cart",
        description: "Get current cart with totals and recommendations",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" }
          },
          required: ["session_id"]
        }
      },
      {
        name: "create_payment_intent",
        description: "Create a server-priced pending order and bound Stripe PaymentIntent",
        inputSchema: {
          type: "object",
          properties: {
            shippingAddress: {
              type: "object",
              properties: {
                line1: { type: "string" },
                line2: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                postal_code: { type: "string" },
                country: { type: "string", default: "US" },
                recipient: { type: "string" },
                email: { type: "string" }
              },
              required: ["line1", "city", "region", "postal_code"]
            },
            shippingMethodId: { type: "string" },
            discountCodes: { type: "array", items: { type: "string" } },
            giftCardToken: { type: "string" },
            session_id: { type: "string" }
          },
          required: ["shippingAddress", "shippingMethodId", "session_id"]
        }
      },
      {
        name: "place_order",
        description: "Finalize a server-created pending order after verified payment",
        inputSchema: {
          type: "object",
          properties: {
            orderId: { type: "string" },
            paymentIntentId: { type: "string" },
            session_id: { type: "string" }
          },
          required: ["orderId", "paymentIntentId", "session_id"]
        }
      },
      {
        name: "get_order_status",
        description: "Get order status and tracking information",
        inputSchema: {
          type: "object",
          properties: {
            orderId: { type: "string" }
          },
          required: ["orderId"]
        }
      },
      {
        name: "get_shipping_options",
        description: "Get available shipping options with cost and time estimates",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "object",
              properties: {
                line1: { type: "string" },
                line2: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                postal_code: { type: "string" },
                country: { type: "string", default: "US" }
              },
              required: ["line1", "city", "region", "postal_code"]
            },
            session_id: { type: "string" }
          },
          required: ["address", "session_id"]
        }
      },
      {
        name: "validate_payment",
        description: "Validate payment method and get processing information",
        inputSchema: {
          type: "object",
          properties: {
            payment_method: {
              type: "string",
              enum: ["stripe"],
              description: "Payment method to validate"
            },
            billing_address: {
              type: "object",
              properties: {
                line1: { type: "string" },
                line2: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                postal_code: { type: "string" },
                country: { type: "string", default: "US" }
              }
            },
            session_id: { type: "string" }
          },
          required: ["payment_method", "session_id"]
        }
      },
      {
        name: "create_agent",
        description: "Create a new MCP agent with API key and permissions",
        inputSchema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "Unique identifier for the agent"
            },
            name: {
              type: "string",
              description: "Human-readable name for the agent"
            },
            description: {
              type: "string",
              description: "Optional description of the agent's purpose"
            },
            permissions: {
              type: "array",
              items: { type: "string" },
              description: "List of permissions for the agent"
            },
            rateLimitRpm: {
              type: "number",
              description: "Requests per minute limit (default: 100)"
            },
            rateLimitOph: {
              type: "number",
              description: "Operations per hour limit (default: 10)"
            },
            apiKeyTtlDays: {
              type: "number",
              minimum: 1,
              maximum: 365,
              default: 90,
              description: "Credential lifetime in days"
            },
            session_id: { type: "string" }
          },
          required: ["agentId", "name"]
        }
      },
      {
        name: "rotate_agent_key",
        description: "Rotate an agent API key and return the replacement once",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            apiKeyTtlDays: { type: "number", minimum: 1, maximum: 365 },
            session_id: { type: "string" }
          },
          required: ["agentId"]
        }
      },
      {
        name: "list_agents",
        description: "List MCP agents with bounded pagination",
        inputSchema: {
          type: "object",
          properties: {
            page: {
              type: "number",
              description: "Page number (default: 1)"
            },
            limit: {
              type: "number",
              description: "Items per page (default: 20, max: 100)"
            },
            session_id: { type: "string" }
          }
        }
      },
      {
        name: "get_agent_details",
        description: "Get detailed information about a specific agent",
        inputSchema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "Agent ID to get details for"
            },
            session_id: { type: "string" }
          },
          required: ["agentId"]
        }
      },
      {
        name: "update_agent_status",
        description: "Update agent active status (enable/disable)",
        inputSchema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "Agent ID to update"
            },
            isActive: {
              type: "boolean",
              description: "Whether the agent should be active"
            },
            session_id: { type: "string" }
          },
          required: ["agentId"]
        }
      }
    ],
    authentication: {
      type: "api_key",
      description: "Agent API key required in X-Agent-API-Key or Authorization: Bearer header",
      rate_limits: {
        requests_per_minute: 100,
        orders_per_hour: 10
      }
    },
    agent_context: {
      description: "Optional agent context in X-Agent-Context header",
      schema: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "Ignored and replaced by authenticated identity" },
          userId: { type: "string" },
          userPreferences: {
            type: "object",
            properties: {
              budget: { type: "number" },
              brands: { type: "array", items: { type: "string" } },
              activities: { type: "array", items: { type: "string" } },
              location: { type: "string" },
              experience_level: { type: "string" }
            }
          },
          session_context: { type: "string" }
        }
      }
    },
    response_format: {
      description: "All responses follow MCPToolResponse format",
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object", description: "Tool-specific response data" },
          context: {
            type: "object",
            properties: {
              session_id: { type: "string" },
              agent_id: { type: "string" },
              processing_time_ms: { type: "number" }
            }
          },
          recommendations: {
            type: "object",
            properties: {
              alternative_sites: { type: "array", items: { type: "string" } },
              bundling_opportunities: { type: "array", items: { type: "string" } },
              cost_optimization: { type: "array", items: { type: "string" } }
            }
          },
          metadata: {
            type: "object",
            properties: {
              can_fulfill_percentage: { type: "number" },
              estimated_satisfaction: { type: "number" },
              next_actions: { type: "array", items: { type: "string" } }
            }
          }
        },
        required: ["success", "data", "context", "metadata"]
      }
    },
    examples: {
      multi_agent_workflow: [
        "1. assess_request - Determine what items this store can fulfill",
        "2. bulk_add_to_cart - Add purchasable items efficiently",
        "3. get_cart - Validate totals against budget",
        "4. get_shipping_options - Compare shipping methods and costs",
        "5. create_payment_intent - Create the authoritative quote and pending order",
        "6. Complete the returned Stripe PaymentIntent",
        "7. place_order - Verify payment and finalize the order",
        "8. get_order_status - Monitor order progress"
      ]
    }
  };

  return NextResponse.json(schema);
}
