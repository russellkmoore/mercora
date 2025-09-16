/**
 * === AI Article Generation API ===
 * 
 * Generates knowledge base articles using Cloudflare AI to help admin users
 * create comprehensive, well-structured markdown content for customer support.
 * 
 * === Features ===
 * - Uses Cloudflare AI for text generation
 * - Structured markdown output with proper formatting
 * - Context-aware content based on title and user prompt
 * - Optimized for knowledge base articles
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { runAI } from "@/lib/ai/config";

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

    const { title, prompt } = await request.json() as any;

    if (!title || !prompt) {
      return NextResponse.json(
        { error: "Title and prompt are required" },
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

    // Create a detailed system prompt for knowledge article generation
    const systemPrompt = `You are Volt, an AI assistant helping create comprehensive knowledge base articles for an outdoor gear company called Voltique. 

Create a well-structured markdown article with the following guidelines:
- Start with the provided title as an H1 header
- Use proper markdown formatting (headers, lists, code blocks, emphasis)
- Include practical, actionable information
- Add relevant sections like Overview, Steps, Tips, Troubleshooting, or FAQ as appropriate
- Write in a helpful, professional tone
- Include specific examples and details when relevant
- Structure content logically with clear hierarchy
- End with a brief conclusion or next steps

The article should be comprehensive but concise, aimed at helping customers understand the topic thoroughly.`;

    const userPrompt = `Title: ${title}

Topic Description: ${prompt}

Please create a comprehensive knowledge base article covering this topic.`;

    // Generate content using Cloudflare AI
    const response = await runAI(ai, 'CONTENT_GENERATION', {
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

    const generatedContent = response.response || response.content || "";

    if (!generatedContent) {
      return NextResponse.json(
        { error: "No content generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content: generatedContent,
      title: title,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error("AI article generation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate article content",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}