import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAdminPermissions(request);
    
    return NextResponse.json({
      success: authResult.success,
      error: authResult.error,
      userId: authResult.userId
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication check failed' },
      { status: 500 }
    );
  }
}