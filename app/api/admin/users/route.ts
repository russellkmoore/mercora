import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';
import { getAllAdminUsers, addAdminUser, removeAdminUser, getAdminUser } from '@/lib/models/admin';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get admin users from database
    const adminUsers = await getAllAdminUsers();
    
    return NextResponse.json({
      adminUsers: adminUsers.map(user => user.userId),
      adminUserDetails: adminUsers,
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

    const { action, userId, email, displayName } = await request.json() as { 
      action: 'add' | 'remove'; 
      userId: string; 
      email?: string; 
      displayName?: string; 
    };

    if (action === 'add') {
      // Validate user ID format
      if (!userId.match(/^user_[a-zA-Z0-9]+$/)) {
        return NextResponse.json({ 
          error: `Invalid user ID format: ${userId}. User IDs should start with 'user_'` 
        }, { status: 400 });
      }

      // Check if user already exists
      const existingUser = await getAdminUser(userId);
      if (existingUser) {
        return NextResponse.json({ 
          error: 'User is already an admin' 
        }, { status: 400 });
      }

      // Add new admin user
      const newAdmin = await addAdminUser({
        userId,
        email,
        displayName,
        createdBy: authResult.userId,
        role: 'admin'
      });

      if (!newAdmin) {
        return NextResponse.json({ 
          error: 'Failed to add admin user' 
        }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Admin user added successfully',
        user: newAdmin
      });

    } else if (action === 'remove') {
      const success = await removeAdminUser(userId);
      
      if (!success) {
        return NextResponse.json({ 
          error: 'Failed to remove admin user. Cannot remove the last admin.' 
        }, { status: 400 });
      }

      return NextResponse.json({
        message: 'Admin user removed successfully'
      });

    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Must be "add" or "remove"' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing admin users:', error);
    return NextResponse.json(
      { error: 'Failed to process admin users' },
      { status: 500 }
    );
  }
}