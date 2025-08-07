/**
 * Temporary API endpoint for generating tokens
 * DELETE THIS FILE after creating your tokens
 * 
 * Usage: POST /api/admin/generate-token
 * Body: { "name": "token-name", "permissions": ["orders:read", "orders:write"] }
 */

import { NextRequest, NextResponse } from "next/server";
import { generateApiToken, storeApiToken } from "@/lib/auth/unified-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name: string;
      permissions: string[];
      expiresAt?: string;
    };

    if (!body.name || !body.permissions) {
      return NextResponse.json(
        { error: 'Name and permissions are required' },
        { status: 400 }
      );
    }

    // Generate the token
    const token = await generateApiToken();
    
    // Store it in the database
    await storeApiToken(
      body.name,
      token,
      body.permissions,
      body.expiresAt ? new Date(body.expiresAt) : undefined
    );

    return NextResponse.json({
      success: true,
      token: token,
      message: `Token '${body.name}' created successfully`,
      permissions: body.permissions,
      note: "Save this token securely - it won't be shown again!"
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
