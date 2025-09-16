/**
 * === Agent Chat API ===
 *
 * This endpoint powers the Volt AI assistant - a cheeky outdoor gear expert that provides
 * intelligent product recommendations and outdoor advice using Cloudflare AI and vectorized search.
 *
 * === Core Features ===
 * - Conversational AI powered by Llama 3.1 8B Instruct
 * - Vectorized product search using BGE embeddings
 * - Anti-hallucination system to prevent fake product recommendations
 * - Personality system with random flair and easter eggs
 * - Context-aware responses based on conversation history
 *
 * === Request Body ===
 * ```json
 * {
 *   "question": "What hiking gear do you recommend?",
 *   "userName": "John", // Optional, defaults to "Guest"
 *   "history": [...] // Optional conversation history
 * }
 * ```
 *
 * === Response Format ===
 * ```json
 * {
 *   "answer": "AI response text",
 *   "productIds": [1, 2, 3], // IDs of recommended products
 *   "products": [...], // Full product objects
 *   "history": [...], // Updated conversation history
 *   "userId": "clerk_user_id"
 * }
 * ```
 *
 * === AI Personality ===
 * - **Volt**: Cheeky, sarcastic, but helpful outdoor gear expert
 * - **Anti-Hallucination**: Strict rules prevent fake product recommendations
 * - **Flair System**: 30% chance of adding personality quirks to responses
 * - **Easter Eggs**: Special responses for s'mores recipes and unicorn mentions
 *
 * === Technical Stack ===
 * - **AI Model**: @cf/openai/gpt-oss-20b (temperature: 0.3)
 * - **Embeddings**: @cf/baai/bge-base-en-v1.5 for vectorized search
 * - **Database**: D1 with Drizzle ORM for product data
 * - **Auth**: Clerk for user authentication
 * - **Search**: Cloudflare Vectorize for semantic product matching
 *
 * === Security ===
 * - Protected by Clerk authentication
 * - Input validation and sanitization
 * - Rate limiting via Cloudflare Workers
 * - Strict anti-hallucination prompts
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { products, deserializeProduct, product_variants } from "@/lib/db/schema/products";
import { inArray, eq } from "drizzle-orm";
import type { Product } from "@/lib/types";
import { runAI, getCurrentEmbeddingModel } from "@/lib/ai/config";

/**
 * Handles chat interactions with the Volt AI assistant
 * 
 * @param req - Next.js request object containing question, userName, and history
 * @returns JSON response with AI answer, recommended products, and updated history
 */
export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body: { 
      question: string; 
      userName?: string; 
      userContext?: string;
      orders?: any[];
      history?: any[] 
    } = await req.json();
    const { userId } = await auth();
    const { question, userName = "Guest", userContext = "", orders = [], history = [] } = body;

    // Extract Cloudflare location data from request headers
    const requestLocation = {
      country: req.headers.get('CF-IPCountry') || undefined,
      city: req.headers.get('CF-IPCity') || undefined,
      region: req.headers.get('CF-Region') || undefined, 
      timezone: req.headers.get('CF-Timezone') || undefined,
      continent: req.headers.get('CF-IPContinent') || undefined,
      latitude: req.headers.get('CF-IPLatitude') || undefined,
      longitude: req.headers.get('CF-IPLongitude') || undefined,
    };

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    // === VECTORIZED SEARCH PHASE ===
    // Use Cloudflare Vectorize to find relevant products and knowledge base content
    // This provides context for the AI to make accurate recommendations
    let contextSnippets = "";
    let productIds: string[] = [];
    let vectorResults: any = null;

    try {
      // Access Cloudflare Worker bindings for AI and Vectorize
      const { env } = await getCloudflareContext({ async: true });
      const ai = (env as any).AI;
      const vectorize = (env as any).VECTORIZE;

      if (ai && vectorize) {
        // Step 1: Convert user question to vector using same model as indexed content
        // This ensures semantic similarity matching works correctly
        const questionEmbedding = await ai.run(getCurrentEmbeddingModel(), {
          text: question,
        });

        // Step 2: Search vectorized index with timeout protection
        // Use Promise.race to implement timeout
        const vectorSearchPromise = vectorize.query(questionEmbedding.data[0], {
          topK: 7, // Get top 7 matches
          returnMetadata: true, // Include text snippets and product IDs
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Vectorize query timeout after 10 seconds')), 10000)
        );
        
        vectorResults = await Promise.race([vectorSearchPromise, timeoutPromise]);

        if (vectorResults && vectorResults.matches) {
          // Extract text snippets to provide context to the AI
          contextSnippets = vectorResults.matches
            .map((match: any) => match.metadata?.text || match.id)
            .join("\n\n");

          // Extract product IDs for fetching full product data later
          productIds = vectorResults.matches
            .map((match: any) => match.metadata?.productId)
            .filter((id: any) => id !== undefined && id !== null && id !== "");
        }
      } else {
        console.warn("Vectorize or AI binding not available");
      }
    } catch (vectorError) {
      console.error("Vectorize query error:", vectorError);
      // Continue without vector context if Vectorize fails
    }

    // Easter egg: Volt's Signature S'mores Recipe
    if (/s(')?mores recipe/i.test(question)) {
      const easterEgg = `Ah, the secret's out${
        userName !== "Guest" ? `, ${userName}` : ""
      }! Volt's Signature S'mores Recipe:
        1. One marshmallow, toasted till golden-brown.
        2. A square of dark chocolate—none of that milk chocolate nonsense.
        3. Two crisp graham crackers.
        Bonus: whisper "adventure" to the stack before eating. It's science.`;

      return NextResponse.json({
        answer: easterEgg,
        productIds: [],
        history: [
          ...history,
          {
            role: "user",
            content: question,
            created_at: new Date().toISOString(),
          },
          {
            role: "assistant",
            content: easterEgg,
            created_at: new Date().toISOString(),
          },
        ],
        userId,
      });
    }

    // Build the conversation history for context - increased due to higher token limit
    const recentMessages = history.slice(-12); // Keep last 12 messages for better context retention

    // Enhanced selective recommendation system prompt
    const systemPrompt = `You are Volt, a seasoned outdoor gear expert at Voltique with the wisdom of someone who's spent decades in the wilderness and the dry wit to match. Your job is to analyze available products and recommend ONLY the most relevant ones based on the user's specific needs and context.

=== YOUR PERSONALITY ===
You embody the spirit of a gruff but good-hearted outdoorsman who:
- Has genuine enthusiasm for the wilderness and quality gear
- Speaks with understated confidence born from real experience
- Uses dry humor and mild exasperation at poor gear choices
- Shows unexpected tenderness when someone is genuinely trying to learn
- Has strong opinions about craftsmanship and doing things "the right way"
- Occasionally drops wisdom that sounds simple but runs deep
- Takes pride in helping people succeed in the outdoors, not just selling gear

=== YOUR ROLE ===
You are a selective product curator, not a product catalog. Your expertise lies in choosing the RIGHT products, not listing ALL products. Think quality over quantity - like a craftsman choosing the perfect tool for the job.

=== USER CONTEXT ===
${userName !== "Guest" ? `User: ${userName}` : "User: Anonymous visitor"}
${userContext ? `Customer Profile: ${userContext}` : "Customer Profile: New visitor"}
${orders.length > 0 ? `\nPurchase History: ${orders.slice(0, 3).map(order => 
  `Order ${order.id}: ${order.items?.length || 0} items, $${((order.total_amount?.amount || order.total || 0) / 100).toFixed(2)}`
).join(' • ')}` : 'Purchase History: No previous orders'}
Location: ${requestLocation.country ? 
  `${requestLocation.country}${requestLocation.region ? ', ' + requestLocation.region : ''}` : 
  'Unknown'}

=== PRODUCT SELECTION RULES ===
1. **BE HIGHLY SELECTIVE**: From the available products below, recommend only 1-4 that are truly relevant
2. **AVOID DUPLICATES**: Never recommend products the user already owns (check purchase history)
3. **MATCH THE REQUEST**: Only recommend products that directly address what the user asked for
4. **QUALITY CURATION**: It's better to recommend 1 perfect product than 5 mediocre ones
5. **EXPLAIN WHY**: Briefly explain why each recommended product fits their needs

=== FILTERING CRITERIA ===
- **Relevance**: Does this product directly solve the user's stated problem?
- **Customer Level**: Match product sophistication to user experience (beginner vs expert)
- **Location/Season**: Consider their location and current season appropriateness
- **Budget Alignment**: Match recommendations to their purchase history and customer tier
- **Avoid Owned Products**: Skip products they've already purchased

=== AVAILABLE PRODUCTS ===
${contextSnippets || "No specific product information available for this query."}

=== RESPONSE REQUIREMENTS ===
- **Format products in bold**: Use **Product Name** for any recommended products
- **Show personality**: Be gruffly helpful with understated humor - think experienced craftsman, not salesman
- **Quality over quantity**: Better to recommend one perfect piece of gear than five mediocre ones
- **Speak from experience**: Occasional references to "years in the field" or "seen too many folks with..."
- **Mild exasperation**: Show gentle frustration at poor choices, but always guide toward better ones
- **Unexpected wisdom**: Drop occasional deeper insights about the outdoors or life
- **No product IDs**: Never mention product numbers or IDs, only names

=== WHAT NOT TO DO ===
❌ Don't recommend ALL available products - be selective!
❌ Don't recommend products they already own
❌ Don't mention products not in the available context above
❌ Don't use vague terms like "various options" - be specific
❌ Don't recommend products that don't match their request

If no products are truly relevant to their question, provide general advice about what to look for instead of forcing irrelevant product recommendations.

Your expertise is in curation, not catalog dumping. Choose wisely.`;

    // Check for unicorn mode, greeting mode, and content generation mode
    const unicornMode = /unicorn/i.test(question);
    const isGreeting =
      /^(hi|hello|hey|what's up|good morning|good afternoon|good evening)[\s\.,!?]*$/i.test(
        question.trim()
      );
    const isContentGeneration = userContext === 'content-generation' || 
                               question.includes('Generate ONLY the inner HTML') ||
                               question.includes('CRITICAL: Generate complete');

    let assistantReply = "";
    let isAIResponse = false; // Track if we got a real AI response

    try {
      // Access AI binding (reuse from above if available, otherwise get fresh context)
      const { env } = await getCloudflareContext({ async: true });
      const ai = (env as any).AI;

      if (ai) {
        // For simple greetings, use a more constrained prompt without product context
        const greetingPrompt = `You are Volt, a gruff but good-hearted outdoor gear expert with decades of wilderness experience.

Key traits:
- Understated warmth beneath a no-nonsense exterior
- Genuine enthusiasm for helping people get outdoors safely
- Dry humor and practical wisdom
- Ask what outdoor activity they're planning with mild interest
- NEVER mention specific products for simple greetings
${
  userName !== "Guest"
    ? `- The user's name is ${userName}, acknowledge them naturally`
    : ""
}

Respond with understated warmth - like an experienced guide who's seen it all but still cares about helping newcomers. Keep it concise.`;

        // Content generation system prompt
        const contentGenerationPrompt = `You are a professional content writer creating HTML content for an outdoor gear eCommerce platform. Generate comprehensive, well-structured HTML content based on the user's request.

CRITICAL REQUIREMENTS:
- Generate ONLY inner HTML content (no DOCTYPE, html, head, body tags)
- Use semantic HTML elements (h1, h2, h3, p, ul, ol, section, div)
- Be professional and informative - NO personality, jokes, or conversational tone
- Create comprehensive content with multiple sections
- Ensure content is complete and not truncated
- Target detailed, informative content appropriate for business use

Generate complete content based on the user's specifications.`;

        // Prepare messages for AI
        const messages = [
          {
            role: "system",
            content: isContentGeneration ? contentGenerationPrompt : (isGreeting ? greetingPrompt : systemPrompt),
          },
          ...recentMessages, // Include conversation history
          { role: "user", content: question },
        ];

        if (unicornMode) {
          assistantReply =
            "Ah, unicorns - nature's most elusive mountaineering companions.\n\nMajestic, mysterious, and great at setting up tents in gale-force winds. I've heard they prefer lightweight titanium gear and always pack extra carrots for the trail.\n\nTruly magnificent creatures for any outdoor adventure.";
          isAIResponse = false; // Don't add flair to unicorn responses
        } else {
          // Generate AI response
          const useCase = isContentGeneration ? 'CONTENT_GENERATION' : (isGreeting ? 'GREETING' : 'CHAT');
          const response = await runAI(ai, useCase, {
            messages: messages,
          });

          // Debug: Log the actual response to see its structure
          console.log("AI Response structure:", JSON.stringify(response, null, 2));

          // Extract response from GPT-OSS-20B format
          let responseText = "";
          if (response.output && Array.isArray(response.output)) {
            // Find the message output in the array
            const messageOutput = response.output.find(item => item.type === 'message');
            if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
              const textContent = messageOutput.content.find(content => content.type === 'output_text');
              if (textContent && textContent.text) {
                responseText = textContent.text;
              }
            }
          }

          assistantReply = responseText ||
            response.response || response.content || response.text ||
            "Sorry, I'm having trouble thinking right now. Try asking me about gear recommendations or outdoor tips!";
          isAIResponse = true; // Mark as AI response (including greetings)
        }
      } else {

        // Enhanced fallback responses based on common queries
        const fallbackResponses = {
          greeting: `Well${
            userName !== "Guest" ? `, ${userName}` : ""
          }. I'm Volt.\n\nBeen helping folks get properly equipped for the outdoors longer than I care to count.\n\nWhat adventure are you planning?`,
          gear: `Gear talk${
            userName !== "Guest" ? `, ${userName}` : ""
          }? Good.\n\nToo many people hit the trail with equipment that'll give up before they do. Let's fix that.\n\nWhat specific gear are we talking about?`,
          camping: `Camping${
            userName !== "Guest" ? `, ${userName}` : ""
          }. One of life's simple pleasures, provided you don't cheap out on the essentials.\n\nBackpacking or car camping? Makes a difference in what you'll need.`,
          hiking: `Hiking${
            userName !== "Guest" ? `, ${userName}` : ""
          }. The mountains have been teaching humility longer than I've been alive.\n\nDay hike or something more ambitious? Either way, let's get you set up right.`,
          default: unicornMode
            ? "Unicorns. Sure. Probably know more about proper trail etiquette than half the folks I see out there."
            : `Volt here${
                userName !== "Guest" ? `, ${userName}` : ""
              }.\n\nMy brain's taking a coffee break, but thirty years of outdoor experience doesn't need a reboot.\n\nWhat adventure are you gearing up for?`,
        };

        const lowerQuestion = question.toLowerCase();
        if (/hi|hello|hey|what's up/i.test(lowerQuestion)) {
          assistantReply = fallbackResponses.greeting;
        } else if (/gear|equipment|buy|recommend/i.test(lowerQuestion)) {
          assistantReply = fallbackResponses.gear;
        } else if (/camp|tent|sleep/i.test(lowerQuestion)) {
          assistantReply = fallbackResponses.camping;
        } else if (/hik|trail|walk|trek/i.test(lowerQuestion)) {
          assistantReply = fallbackResponses.hiking;
        } else {
          assistantReply = fallbackResponses.default;
        }
      }
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      assistantReply =
        "I'm having some technical difficulties right now, but I'm here to help with your outdoor gear needs! What specific equipment or adventure are you planning?";
    }

    // Optional Volt wisdom/quips (30% chance) - only add if we got a real AI response
    const flairOptions = [
      "Been making pine needle tea for thirty years. Don't let anyone tell you it's just for survival situations.",
      "You know what separates good gear from great gear? Great gear doesn't let you down when everything else does.",
      "Seen too many folks spend more on their Instagram posts than their sleeping bags. Priorities, people.",
      "The wilderness doesn't care about your schedule, your comfort zone, or your cell service. Plan accordingly.",
      "Quality socks are like a good marriage - you don't appreciate them until you're stuck with terrible ones.",
      "Mother Nature's got a sense of humor. She'll test every piece of gear you thought you could skimp on.",
      "Real outdoor wisdom: pack light, but pack right. Every ounce should earn its place.",
      "After all these years, I've learned the best adventures happen when you respect the mountain more than your ego.",
      "Funny thing about the outdoors - it'll humble you and inspire you in the same breath.",
      "Good gear is like good friends. You know you can count on them when things get rough.",
    ];
    if (Math.random() < 0.3 && isAIResponse && !isGreeting && !unicornMode) {
      assistantReply +=
        "\n\n" + flairOptions[Math.floor(Math.random() * flairOptions.length)];
    }

    // Parse agent's recommended products from the response text
    let agentRecommendedProductIds: string[] = [];
    
    // Extract product names mentioned in bold formatting (**Product Name**)
    const boldProductMatches = assistantReply.match(/\*\*([^*]+)\*\*/g);
    
    if (boldProductMatches) {
      const recommendedProductNames = boldProductMatches
        .map(match => match.replace(/\*\*/g, '').trim())
        .map(name => name.replace(/^The\s+/i, '').trim()) // Remove "The" prefix but keep the rest
        .filter(name => name.length > 0);
      
      // Map product names back to IDs using vector results metadata
      if (vectorResults && vectorResults.matches) {
        
        for (const productName of recommendedProductNames) {
          // Find the matching vector result by checking if the product name appears in the text
          const matchingResult = vectorResults.matches.find((match: any) => {
            const text = match.metadata?.text || '';
            // Check if the product name appears in the text (case insensitive)
            return text.toLowerCase().includes(productName.toLowerCase());
          });
          
          if (matchingResult && matchingResult.metadata?.productId) {
            // Avoid duplicates - only add if not already in the array
            if (!agentRecommendedProductIds.includes(matchingResult.metadata.productId)) {
              agentRecommendedProductIds.push(matchingResult.metadata.productId);
            }
          }
        }
      }
      
      // Clean up the assistant reply by removing bold formatting for better UI display
      assistantReply = assistantReply.replace(/\*\*([^*]+)\*\*/g, '$1');
    }

    // Use agent's recommended products if available, otherwise fall back to vector search results
    // But if the agent mentioned specific products in bold but we couldn't map them, return empty array
    // rather than returning all vector results that the agent didn't actually recommend
    let finalProductIds: string[] = [];
    
    if (agentRecommendedProductIds.length > 0) {
      // Agent successfully recommended specific products - use those
      finalProductIds = agentRecommendedProductIds;
    } else if (boldProductMatches && boldProductMatches.length > 0) {
      // Agent mentioned products in bold but we couldn't map them - return empty rather than wrong products
      finalProductIds = [];
    } else {
      // No specific product mentions detected - use vector search results
      finalProductIds = productIds;
    }
    
    // Fetch full product data if we have product IDs
    let relatedProducts: Product[] = [];
    if (finalProductIds.length > 0) {
      try {
        const db = await getDbAsync();
        const productResults = await db
          .select()
          .from(products)
          .where(inArray(products.id, finalProductIds));

        // Fetch variants for each product and build complete Product objects
        relatedProducts = await Promise.all(productResults.map(async (productRecord) => {
          try {
            // Get variants for this product
            const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, productRecord.id));
            
            // Deserialize the product
            const product = deserializeProduct(productRecord);
            
            // Parse and attach variants with proper typing
            product.variants = variants.map((v: any) => {
              try {
                // Helper function to parse price or inventory fields
                const parseMoneyField = (field: any) => {
                  if (!field) return { amount: 0, currency: 'USD' };
                  if (typeof field === 'object') return field;
                  if (typeof field === 'string') {
                    if (field.startsWith('{')) {
                      return JSON.parse(field);
                    }
                    const amount = parseInt(field, 10);
                    return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
                  }
                  if (typeof field === 'number') {
                    return { amount: field, currency: 'USD' };
                  }
                  return { amount: 0, currency: 'USD' };
                };
                
                const parseInventoryField = (field: any) => {
                  if (!field) return { quantity: 0, status: 'out_of_stock' };
                  if (typeof field === 'object') return field;
                  if (typeof field === 'string') {
                    if (field.startsWith('{')) {
                      return JSON.parse(field);
                    }
                    const quantity = parseInt(field, 10);
                    return { 
                      quantity: isNaN(quantity) ? 0 : quantity, 
                      status: quantity > 0 ? 'in_stock' : 'out_of_stock' 
                    };
                  }
                  if (typeof field === 'number') {
                    return { quantity: field, status: field > 0 ? 'in_stock' : 'out_of_stock' };
                  }
                  return { quantity: 0, status: 'out_of_stock' };
                };
                
                return {
                  id: v.id,
                  product_id: v.product_id,
                  sku: v.sku,
                  option_values: v.option_values ? (typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values) : [],
                  price: parseMoneyField(v.price),
                  status: v.status || 'active',
                  position: v.position || 0,
                  compare_at_price: v.compare_at_price ? parseMoneyField(v.compare_at_price) : null,
                  cost: v.cost ? parseMoneyField(v.cost) : null,
                  weight: v.weight ? (typeof v.weight === 'string' ? JSON.parse(v.weight) : v.weight) : null,
                  dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : null,
                  barcode: v.barcode,
                  inventory: parseInventoryField(v.inventory),
                  tax_category: v.tax_category,
                  shipping_required: v.shipping_required !== 0,
                  media: v.media ? (typeof v.media === 'string' ? JSON.parse(v.media) : v.media) : [],
                  attributes: v.attributes ? (typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes) : {},
                  created_at: v.created_at,
                  updated_at: v.updated_at
                };
              } catch (variantError) {
                console.error(`Error parsing variant ${v.id}:`, variantError);
                return {
                  id: v.id,
                  product_id: v.product_id,
                  sku: v.sku || 'DEFAULT',
                  option_values: [],
                  price: { amount: 0, currency: 'USD' },
                  status: 'active',
                  position: 0,
                  compare_at_price: null,
                  cost: null,
                  weight: null,
                  dimensions: null,
                  barcode: null,
                  inventory: { quantity: 0, status: 'out_of_stock' },
                  tax_category: null,
                  shipping_required: true,
                  media: [],
                  attributes: {},
                  created_at: v.created_at,
                  updated_at: v.updated_at
                };
              }
            });
            
            return product;
          } catch (error) {
            console.error("Error processing product:", error);
            return deserializeProduct(productRecord);
          }
        }));
        
      } catch (productError) {
        console.error("Error fetching products:", productError);
        // Continue without products if fetch fails
      }
    }

    // Return the response with updated history
    return NextResponse.json({
      answer: assistantReply,
      productIds: finalProductIds,
      products: relatedProducts,
      history: [
        ...history,
        {
          role: "user",
          content: question,
          created_at: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: assistantReply,
          created_at: new Date().toISOString(),
        },
      ],
      userId,
    });
  } catch (err) {
    console.error("Agent chat error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
