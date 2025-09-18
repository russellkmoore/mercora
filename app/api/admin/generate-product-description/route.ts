/**
 * === AI Product Description Generation API ===
 * 
 * Generates compelling product descriptions using Cloudflare AI to help admin users
 * create professional, marketing-focused content that highlights key features and benefits.
 * 
 * === Features ===
 * - Uses Cloudflare AI for text generation
 * - Product-focused content optimization
 * - Context-aware descriptions based on product details
 * - Marketing and sales-oriented language
 * - SEO-friendly structure
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { runAI, extractAIResponse } from "@/lib/ai/config";

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || "Admin access required" },
        { status: 403 }
      );
    }

    const { productName, prompt, brand, category, price } = await request.json() as any;

    if (!productName || !prompt) {
      return NextResponse.json(
        { error: "Product name and prompt are required" },
        { status: 400 }
      );
    }

    // Get Cloudflare AI binding
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as any).AI;

    if (!ai) {
      return NextResponse.json(
        { error: "AI service not available" },
        { status: 500 }
      );
    }

    // Create a detailed system prompt for product description generation
    const systemPrompt = `You are Volt, a marketing expert AI assistant for Voltique, an outdoor gear company specializing in tactical and adventure equipment. 

Create compelling, professional product descriptions that:
- Highlight key features and benefits clearly
- Use engaging, adventure-focused language
- Appeal to outdoor enthusiasts and tactical professionals
- Include practical use cases and scenarios
- Emphasize quality, durability, and performance
- Keep descriptions concise but informative (2-4 paragraphs)
- Use active voice and compelling marketing language
- Focus on what makes the product special and valuable

Write descriptions that would make customers excited to buy and use this gear on their next adventure.`;

    let contextInfo = `Product: ${productName}`;
    if (brand) contextInfo += `\nBrand: ${brand}`;
    if (category) contextInfo += `\nCategory: ${category}`;
    if (price) contextInfo += `\nPrice: ${price}`;

    const userPrompt = `${contextInfo}

Product Details: ${prompt}

Please create a compelling product description for this outdoor gear item.`;

    // Generate content using Cloudflare AI
    const response = await runAI(ai, 'MARKETING', {
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
    });

    const generatedDescription = extractAIResponse(response) || "";

    if (!generatedDescription) {
      return NextResponse.json(
        { error: "No description generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      description: generatedDescription,
      productName: productName,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error("AI product description generation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate product description",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}