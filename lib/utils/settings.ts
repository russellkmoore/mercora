/**
 * === Settings Utilities ===
 *
 * Utility functions for working with admin settings.
 * Provides typed access to configuration values stored in database.
 *
 * === Features ===
 * - **Typed Access**: Get settings with proper type conversion
 * - **Category Filtering**: Retrieve settings by category
 * - **JSON Parsing**: Automatic parsing of JSON values
 * - **Default Values**: Fallback handling for missing settings
 *
 * === Usage ===
 * ```typescript
 * const refundSettings = await getSettings('refund');
 * const allSettings = await getSettings();
 * ```
 */

import { getDbAsync } from '@/lib/db';
import { admin_settings } from '@/lib/db/schema/settings';
import { eq } from 'drizzle-orm';

/**
 * Get a typed settings object for easy use in components
 * @param category - Optional category filter (store, refund, ai, system)
 * @returns Promise<Record<string, any>> - Settings key-value object
 */
export async function getSettings(category?: string): Promise<Record<string, any>> {
  const db = await getDbAsync();
  
  let settings;
  if (category) {
    settings = await db.select().from(admin_settings).where(eq(admin_settings.category, category));
  } else {
    settings = await db.select().from(admin_settings);
  }
  
  const result: Record<string, any> = {};
  for (const setting of settings) {
    try {
      result[setting.key] = JSON.parse(setting.value as string);
    } catch {
      result[setting.key] = setting.value;
    }
  }
  
  return result;
}

/**
 * Get refund policy settings specifically
 * @returns Promise<RefundPolicy> - Refund policy configuration
 */
export async function getRefundPolicy() {
  const refundSettings = await getSettings('refund');
  
  return {
    refundShipping: refundSettings['refund.shipping_refunded'] || false,
    refundShippingOnFullReturn: refundSettings['refund.shipping_refunded_on_full_return'] || false,
    restockingFeePercent: refundSettings['refund.restocking_fee_percent'] || 0,
    minimumRefundAmount: refundSettings['refund.minimum_refund_amount'] || 0,
    applyRestockingFeeOnPartialReturn: refundSettings['refund.apply_restocking_fee_on_partial'] !== false
  };
}

/**
 * Get store settings specifically
 * @returns Promise<StoreSettings> - Store configuration
 */
export async function getStoreSettings() {
  const storeSettings = await getSettings('store');
  
  return {
    name: storeSettings['store.name'] || 'Voltique',
    currency: storeSettings['store.currency'] || 'USD',
    taxRate: storeSettings['store.tax_rate'] || 8.25,
    // Add more store settings as needed
  };
}

/**
 * Get AI settings specifically
 * @returns Promise<AISettings> - AI configuration
 */
export async function getAISettings() {
  const aiSettings = await getSettings('ai');
  
  return {
    personalityMode: aiSettings['ai.personality_mode'] || 'cheeky',
    // Add more AI settings as needed
  };
}

export interface RefundPolicy {
  refundShipping: boolean;
  refundShippingOnFullReturn: boolean;
  restockingFeePercent: number;
  minimumRefundAmount: number;
  applyRestockingFeeOnPartialReturn: boolean;
}