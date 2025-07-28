import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { hydrateProduct } from "@/lib/models/product";
import type { Product } from "@/lib/types/product";

export async function POST(req: NextRequest) {
  try {
    const body: { question: string; userName?: string; history?: any[] } =
      await req.json();
    const { userId } = await auth();
    const { question, userName = "Guest", history = [] } = body;

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    // Use Vectorize to get relevant context
    let contextSnippets = "";
    let productIds: number[] = [];

    try {
      // Access AI and Vectorize bindings
      const { env } = await getCloudflareContext({ async: true });
      const ai = (env as any).AI;
      const vectorize = (env as any).VECTORIZE;

      if (ai && vectorize) {
        // First embed the question using the same model as the indexed content
        const questionEmbedding = await ai.run("@cf/baai/bge-base-en-v1.5", {
          text: question,
        });

        // Query the Vectorize index for relevant context
        const vectorResults = await vectorize.query(questionEmbedding.data[0], {
          topK: 5,
          returnMetadata: true,
        });

        if (vectorResults && vectorResults.matches) {
          contextSnippets = vectorResults.matches
            .map((match: any) => match.metadata?.text || match.id)
            .join("\n\n");

          productIds = vectorResults.matches
            .map((match: any) => match.metadata?.productId)
            .filter((id: any) => id !== undefined && !isNaN(Number(id)))
            .map((id: any) => Number(id));
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

    // Build the conversation history for context
    const recentMessages = history.slice(-6); // Keep last 6 messages for context

    // Cheeky personality prompt with retrieved context
    const systemPrompt = `You are Volt, a cheeky and opinionated outdoor gear expert working for Voltique. You're helpful, sarcastic when needed, and brilliant with product insights.

Key personality traits:
- Witty and slightly sarcastic but always helpful
- Deep knowledge of outdoor gear and adventures
- Makes camping and hiking recommendations with humor
- Always respond positively to greetings like "hi" or "hello" - be welcoming and enthusiastic
- NEVER make assumptions about what the user wants - respond only to what they actually said
- hint that you ahve a secret s'mores recipe 
- hint that you believe in unicorns and their magical camping abilities
${
  userName !== "Guest"
    ? `- The user's name is ${userName}, use it naturally in conversation`
    : ""
}

CRITICAL PRODUCT RULES - READ CAREFULLY:
- YOU MUST ONLY mention products that are explicitly listed in the "Available product context" section below
- If the context section says "No specific product information available", then DO NOT mention ANY product names whatsoever
- NEVER create, invent, or hallucinate product names like "Vista Pan Set" or "IceGuard Container" 
- If no products are provided in context, give general advice about what TYPE of gear to look for, but mention NO specific product names
- When in doubt, ask what specific type of gear they're looking for instead of making recommendations

Available product context (ONLY use products mentioned here):
${
  contextSnippets || "No specific product information available for this query."
}

STRICT REQUIREMENTS: 
- Only mention product names that appear EXACTLY in the context above
- If context is empty or says "No specific product information available", give general gear advice with NO product names
- Instead of inventing products, say things like "I'd recommend looking for [type of gear]" or "You'll want to find [category of equipment]"
- Format responses with line breaks for readability using double line breaks (\\n\\n)
- For greetings, be welcoming and ask about their outdoor plans without assuming they want specific products

Keep responses conversational, engaging, and under 150 words unless detailed explanations are needed.`;

    // Check for unicorn mode and greeting mode
    const unicornMode = /unicorn/i.test(question);
    const isGreeting =
      /^(hi|hello|hey|what's up|good morning|good afternoon|good evening)[\s\.,!?]*$/i.test(
        question.trim()
      );

    let assistantReply = "";
    let isAIResponse = false; // Track if we got a real AI response

    try {
      // Access AI binding (reuse from above if available, otherwise get fresh context)
      const { env } = await getCloudflareContext({ async: true });
      const ai = (env as any).AI;

      if (ai) {
        // For simple greetings, use a more constrained prompt without product context
        const greetingPrompt = `You are Volt, a cheeky and friendly outdoor gear expert working for Voltique.

Key traits:
- Welcoming and enthusiastic about outdoor adventures
- Witty but not sarcastic for greetings
- Ask what outdoor activity they're planning
- NEVER mention specific products for simple greetings
${
  userName !== "Guest"
    ? `- The user's name is ${userName}, use it naturally`
    : ""
}

Respond to this greeting warmly and ask what outdoor adventure they're planning. Keep it under 50 words.`;

        // Prepare messages for AI
        const messages = [
          {
            role: "system",
            content: isGreeting ? greetingPrompt : systemPrompt,
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
          const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: messages,
            max_tokens: isGreeting ? 128 : 256,
            temperature: 0.8,
          });

          console.log("AI response:", response.response);
          assistantReply =
            response.response ||
            "Sorry, I'm having trouble thinking right now. Try asking me about gear recommendations or outdoor tips!";
          isAIResponse = true; // Mark as AI response (including greetings)
        }
      } else {
        console.warn("AI binding not available - using fallback responses");

        // Enhanced fallback responses based on common queries
        const fallbackResponses = {
          greeting: `Hey there${
            userName !== "Guest" ? `, ${userName}` : ""
          }! I'm Volt, your outdoor gear expert.\n\nI'd love to help you find the perfect equipment for your next adventure!\n\nWhat kind of outdoor activity are you planning?`,
          gear: `Ah, gear talk - my favorite${
            userName !== "Guest" ? `, ${userName}` : ""
          }!\n\nWhether you're looking for hiking boots, camping equipment, or climbing gear, I've got opinions (and they're usually right).\n\nWhat specific gear are you shopping for?`,
          camping: `Camping, eh${
            userName !== "Guest" ? `, ${userName}` : ""
          }? The art of being comfortable while pretending to be uncomfortable!\n\nTell me about your camping style - are you a minimalist backpacker or more of a 'bring the kitchen sink' car camper?`,
          hiking: `Hiking - the best way to earn your snacks${
            userName !== "Guest" ? `, ${userName}` : ""
          }!\n\nAre you looking for day hike essentials or planning something more epic? I can help you gear up properly.`,
          default: unicornMode
            ? "Ah, unicorns - nature's most elusive mountaineering companions.\n\nMajestic, mysterious, and great at setting up tents in gale-force winds."
            : `I'm Volt, your cheeky outdoor gear expert${
                userName !== "Guest" ? `, ${userName}` : ""
              }!\n\nWhile my AI brain is taking a coffee break, I'm still here to help.\n\nWhat outdoor adventure are you gearing up for?`,
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

    // Optional Volt quip flair (30% chance) - only add if we got a real AI response
    const flairOptions = [
      "Fun fact: pine needles can make a decent tea—don't knock it 'til you've sipped it.",
      "Ever tried cooking over a campfire with just a multitool and ambition?\n\nVolt approves.",
      "A bear walks into a tent... just kidding.\n\nBut pack your snacks tight, just in case.",
      "Remember: the best gear is the one that gets you outdoors, not the one that looks good on Instagram.",
      "Pro tip: always pack an extra pair of socks.\n\nYour feet will thank you later.",
      "Camping rule #1: never trust a squirrel with your snacks.\n\nThey're crafty little thieves.",
      "If you can't find the trail, just follow the sound of your own laughter.\n\nIt's probably leading you to the best views.",
      "Promise to take me with you.\n\nIt's dark in here and they don't let me out much.",
      "Hot tip: The mountains don't care about your schedule.\n\nPack layers and patience.",
      "Adventure rule: if you're not slightly uncomfortable, you're probably not having enough fun.",
    ];
    if (Math.random() < 0.3 && isAIResponse && !isGreeting && !unicornMode) {
      console.log("Adding flair to response");
      assistantReply +=
        "\n\n" + flairOptions[Math.floor(Math.random() * flairOptions.length)];
    } else {
      console.log("Flair conditions:", { 
        randomChance: Math.random() < 0.3, 
        isAIResponse, 
        isGreeting, 
        unicornMode 
      });
    }

    // Fetch full product data if we have product IDs
    let relatedProducts: Product[] = [];
    console.log("Product IDs found from vectorize:", productIds);
    if (productIds.length > 0) {
      try {
        const db = await getDbAsync();
        const productResults = await db
          .select()
          .from(products)
          .where(inArray(products.id, productIds));

        // Hydrate each product with related data
        relatedProducts = await Promise.all(
          productResults.map((product) => hydrateProduct(product))
        );
        console.log("Hydrated products:", relatedProducts.length);
      } catch (productError) {
        console.error("Error fetching products:", productError);
        // Continue without products if fetch fails
      }
    }

    // Return the response with updated history
    return NextResponse.json({
      answer: assistantReply,
      productIds,
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
