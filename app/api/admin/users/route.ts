import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get current admin users from environment
    const adminUsers = process.env.ADMIN_USER_IDS?.split(',').filter(id => id.trim()) || [];
    
    return NextResponse.json({
      adminUsers,
      count: adminUsers.length
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { adminUsers } = await request.json() as { adminUsers: string[] };
    
    if (!Array.isArray(adminUsers)) {
      return NextResponse.json({ error: 'adminUsers must be an array' }, { status: 400 });
    }

    // Validate user IDs format (should start with user_)
    const invalidUsers = adminUsers.filter(id => !id.match(/^user_[a-zA-Z0-9]+$/));
    if (invalidUsers.length > 0) {
      return NextResponse.json({ 
        error: `Invalid user ID format: ${invalidUsers.join(', ')}. User IDs should start with 'user_'` 
      }, { status: 400 });
    }

    // Note: This endpoint can show current admin users and validate format,
    // but updating ADMIN_USER_IDS requires manual secret management via Wrangler
    // since we can't programmatically update Cloudflare Workers secrets
    
    return NextResponse.json({
      message: 'Admin users validated successfully. To update, use: wrangler secret put ADMIN_USER_IDS',
      command: `echo "${adminUsers.join(',')}" | npx wrangler secret put ADMIN_USER_IDS`,
      currentUsers: process.env.ADMIN_USER_IDS?.split(',').filter(id => id.trim()) || []
    });
  } catch (error) {
    console.error('Error processing admin users:', error);
    return NextResponse.json(
      { error: 'Failed to process admin users' },
      { status: 500 }
    );
  }
}