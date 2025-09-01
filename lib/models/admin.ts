import { eq, and } from 'drizzle-orm';
import { getDbAsync } from '../db';
import { adminUsers, type AdminUser, type NewAdminUser } from '../db/schema';

/**
 * Admin user management functions
 */

/**
 * Check if a user ID has admin access
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const db = await getDbAsync();
    const adminUser = await db
      .select()
      .from(adminUsers)
      .where(and(
        eq(adminUsers.userId, userId),
        eq(adminUsers.isActive, true)
      ))
      .limit(1);
    
    return adminUser.length > 0;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get admin user by user ID
 */
export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  try {
    const db = await getDbAsync();
    const adminUser = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.userId, userId))
      .limit(1);
    
    return adminUser[0] || null;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}

/**
 * Get all active admin users
 */
export async function getAllAdminUsers(): Promise<AdminUser[]> {
  try {
    const db = await getDbAsync();
    return await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.isActive, true))
      .orderBy(adminUsers.createdAt);
  } catch (error) {
    console.error('Error getting all admin users:', error);
    return [];
  }
}

/**
 * Add a new admin user
 */
export async function addAdminUser(newAdmin: NewAdminUser): Promise<AdminUser | null> {
  try {
    const db = await getDbAsync();
    const result = await db
      .insert(adminUsers)
      .values(newAdmin)
      .returning();
    
    return result[0] || null;
  } catch (error) {
    console.error('Error adding admin user:', error);
    return null;
  }
}

/**
 * Remove admin access for a user
 */
export async function removeAdminUser(userId: string): Promise<boolean> {
  try {
    // Check if this is the last admin
    const allAdmins = await getAllAdminUsers();
    if (allAdmins.length <= 1) {
      throw new Error('Cannot remove the last admin user');
    }

    const db = await getDbAsync();
    await db
      .update(adminUsers)
      .set({ isActive: false })
      .where(eq(adminUsers.userId, userId));
    
    return true;
  } catch (error) {
    console.error('Error removing admin user:', error);
    return false;
  }
}

/**
 * Update admin user's last login
 */
export async function updateAdminLastLogin(userId: string): Promise<void> {
  try {
    const db = await getDbAsync();
    await db
      .update(adminUsers)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(adminUsers.userId, userId));
  } catch (error) {
    console.error('Error updating admin last login:', error);
  }
}

/**
 * Get admin user count
 */
export async function getAdminUserCount(): Promise<number> {
  try {
    const admins = await getAllAdminUsers();
    return admins.length;
  } catch (error) {
    console.error('Error getting admin user count:', error);
    return 0;
  }
}