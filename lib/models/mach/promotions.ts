import { promotions, transformPromotionForDB, isActivePromotion, canBeUsedByCustomer, canBeUsedInChannel, canBeUsedInRegion, generatePromotionSlug, getActionsByType, getConditionsByType, hasCartSubtotalCondition, getCartMinimumAmount, getTotalUsesRemaining, isExpiredPromotion, isCodeBasedPromotion, isAutomaticPromotion, getLocalizedValue } from "../../db/schema/promotions";
import { eq, and, or, sql, isNotNull, isNull, gte, lte, desc, asc } from "drizzle-orm";
import { 
  type MACHPromotion,
  type MACHPromotionRules,
  type MACHPromotionCodes,
  type MACHUsageLimits,
  type MACHEligibility,
  type MACHAction,
  type MACHCondition
} from "../../types/mach/Promotion";

// Define additional types that weren't in the original file
export type MACHPromotionType = "cart" | "product" | "shipping";
export type MACHPromotionStatus = "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";
export type PromotionActivationMethod = "automatic" | "code" | "customer_specific" | "link";

export interface PromotionFilterOptions {
  type?: MACHPromotionType;
  status?: MACHPromotionStatus | MACHPromotionStatus[];
  activationMethod?: PromotionActivationMethod;
  stackable?: boolean;
  validOn?: Date | string;
  priority?: { min?: number; max?: number };
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PromotionCreateInput extends Partial<MACHPromotion> {
  id: string;
  name: string | Record<string, string>;
  type: MACHPromotionType;
  rules: MACHPromotionRules;
}

export interface PromotionUpdateInput extends Partial<MACHPromotion> {
  id?: never; // Prevent ID updates
}

export interface PromotionEvaluationContext {
  customerId?: string;
  customerType?: string;
  customerSegments?: string[];
  channel?: string;
  region?: string;
  cartSubtotal?: number;
  cartItems?: Array<{
    productId: string;
    category?: string;
    price: number;
    quantity: number;
  }>;
  isFirstPurchase?: boolean;
  previousPromotionUses?: number;
}

// Utility functions for promotion validation and evaluation
export function validatePromotionObject(data: Partial<MACHPromotion>): boolean {
  if (!data.id || !data.name || !data.type || !data.rules) {
    return false;
  }
  return true;
}

export function generatePromotionCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function checkTimeValidity(promotion: MACHPromotion): boolean {
  const now = new Date();
  
  if (promotion.valid_from) {
    const validFrom = new Date(promotion.valid_from);
    if (now < validFrom) return false;
  }
  
  if (promotion.valid_to) {
    const validTo = new Date(promotion.valid_to);
    if (now > validTo) return false;
  }
  
  return true;
}

export function checkUsageLimits(promotion: MACHPromotion, context: PromotionEvaluationContext): boolean {
  if (!promotion.usage_limits) return true;
  
  const limits = promotion.usage_limits;
  
  // Check total uses
  if (limits.total_uses !== undefined && limits.uses_remaining !== undefined) {
    if (limits.uses_remaining <= 0) return false;
  }
  
  // Check per customer limits
  if (limits.per_customer !== undefined && context.previousPromotionUses !== undefined) {
    if (context.previousPromotionUses >= limits.per_customer) return false;
  }
  
  return true;
}

export function checkPromotionEligibility(promotion: MACHPromotion, context: PromotionEvaluationContext): boolean {
  if (!promotion.eligibility) return true;
  
  // Check customer eligibility
  if (context.customerType && !canBeUsedByCustomer(promotion, context.customerType, context.customerSegments)) {
    return false;
  }
  
  // Check channel eligibility
  if (context.channel && !canBeUsedInChannel(promotion, context.channel)) {
    return false;
  }
  
  // Check region eligibility
  if (context.region && !canBeUsedInRegion(promotion, context.region)) {
    return false;
  }
  
  return true;
}

export function evaluatePromotionConditions(rules: MACHPromotionRules, context: PromotionEvaluationContext): boolean {
  if (!rules.conditions || rules.conditions.length === 0) return true;
  
  // Default to 'and' operator for conditions
  const conditionOperator = 'and';
  
  const results = rules.conditions.map(condition => {
    switch (condition.type) {
      case 'cart_subtotal':
        if (context.cartSubtotal === undefined) return false;
        return evaluateNumericCondition(context.cartSubtotal, condition);
      
      case 'product_category':
        if (!context.cartItems) return false;
        const categories = context.cartItems.map(item => item.category).filter(Boolean);
        return evaluateArrayCondition(categories, condition);
      
      case 'first_purchase':
        return context.isFirstPurchase === (condition.value as boolean);
      
      default:
        return true;
    }
  });
  
  return conditionOperator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function evaluateNumericCondition(value: number, condition: MACHCondition): boolean {
  const conditionValue = typeof condition.value === 'object' && condition.value?.amount 
    ? condition.value.amount : condition.value as number;
    
  switch (condition.operator) {
    case 'equals': return value === conditionValue;
    case 'gte': return value >= conditionValue;
    case 'lte': return value <= conditionValue;
    case 'gt': return value > conditionValue;
    case 'lt': return value < conditionValue;
    default: return false;
  }
}

function evaluateArrayCondition(values: (string | undefined)[], condition: MACHCondition): boolean {
  const conditionValue = condition.value;
  
  switch (condition.operator) {
    case 'equals':
      return values.includes(conditionValue as string);
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.some(v => values.includes(v));
    default:
      return false;
  }
}

export function calculatePromotionDiscount(promotion: MACHPromotion, context: PromotionEvaluationContext): number {
  let totalDiscount = 0;
  
  for (const action of promotion.rules.actions) {
    switch (action.type) {
      case 'percentage_discount':
        if (context.cartSubtotal && action.value && typeof action.value === 'number') {
          totalDiscount += context.cartSubtotal * (action.value / 100);
        }
        break;
        
      case 'fixed_discount':
        if (action.value && typeof action.value === 'object' && action.value.amount) {
          totalDiscount += action.value.amount;
        }
        break;
        
      case 'tiered_discount':
        if (action.tiers && context.cartSubtotal) {
          const applicableTier = action.tiers
            .filter(tier => tier.min_value && context.cartSubtotal! >= tier.min_value.amount)
            .sort((a, b) => b.min_value!.amount - a.min_value!.amount)[0];
            
          if (applicableTier) {
            if (applicableTier.discount_type === 'percentage') {
              totalDiscount += context.cartSubtotal * (applicableTier.discount_value / 100);
            } else {
              totalDiscount += applicableTier.discount_value;
            }
          }
        }
        break;
    }
  }
  
  return totalDiscount;
}

export class PromotionModel {
  
  // =====================================================
  // Core CRUD Operations
  // =====================================================
  
  /**
   * Create a new promotion
   */
  async createPromotion(data: PromotionCreateInput): Promise<MACHPromotion | null> {
    // Validate input data
    if (!validatePromotionObject(data as MACHPromotion)) {
      throw new Error("Invalid promotion data");
    }

    // Transform data for storage
    const transformedData = transformPromotionForDB(data as MACHPromotion);

    // Insert into database
    const result = await this.db.insert(promotions).values(transformedData).returning();
    
    if (!result[0]) {
      throw new Error("Failed to create promotion");
    }

    return this.getPromotionById(result[0].id);
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(id: string): Promise<MACHPromotion | null> {
    const result = await this.db.select().from(promotions).where(eq(promotions.id, id));
    
    if (!result[0]) {
      return null;
    }

    return this.hydrateDatabasePromotion(result[0]);
  }

  /**
   * Update existing promotion
   */
  async updatePromotion(id: string, data: PromotionUpdateInput): Promise<MACHPromotion | null> {
    // Get existing promotion
    const existing = await this.getPromotionById(id);
    if (!existing) {
      throw new Error(`Promotion with ID ${id} not found`);
    }

    // Merge with existing data
    const mergedData = { ...existing, ...data };

    // Validate merged data
    if (!validatePromotionObject(mergedData as MACHPromotion)) {
      throw new Error("Invalid promotion data");
    }

    // Transform data for storage
    const transformedData = transformPromotionForDB(mergedData as MACHPromotion);

    // Update in database
    const result = await this.db
      .update(promotions)
      .set(transformedData)
      .where(eq(promotions.id, id))
      .returning();

    if (!result[0]) {
      throw new Error("Failed to update promotion");
    }

    return this.getPromotionById(id);
  }

  /**
   * Delete promotion by ID
   */
  async deletePromotion(id: string): Promise<boolean> {
    const result = await this.db.delete(promotions).where(eq(promotions.id, id));
    return result.rowsAffected > 0;
  }

  // =====================================================
  // Query and Search Operations
  // =====================================================

  /**
   * Get all promotions with optional filtering
   */
  async getPromotions(options: PromotionFilterOptions = {}): Promise<MACHPromotion[]> {
    const {
      type,
      status,
      activationMethod,
      stackable,
      validOn,
      priority,
      limit = 100,
      offset = 0,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = options;

    let query = this.db.select().from(promotions);

    // Apply filters
    const conditions = [];

    if (type) {
      conditions.push(eq(promotions.type, type));
    }

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(or(...status.map(s => eq(promotions.status, s))));
      } else {
        conditions.push(eq(promotions.status, status));
      }
    }

    if (activationMethod) {
      conditions.push(eq(promotions.activation_method, activationMethod));
    }

    if (stackable !== undefined) {
      conditions.push(eq(promotions.stackable, stackable ? 1 : 0));
    }

    if (validOn) {
      const validOnISO = new Date(validOn).toISOString();
      conditions.push(
        and(
          or(isNull(promotions.valid_from), lte(promotions.valid_from, validOnISO)),
          or(isNull(promotions.valid_to), gte(promotions.valid_to, validOnISO))
        )
      );
    }

    if (priority) {
      conditions.push(
        priority.min !== undefined ? gte(promotions.priority, priority.min) : sql`1=1`,
        priority.max !== undefined ? lte(promotions.priority, priority.max) : sql`1=1`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    if (sortBy) {
      switch (sortBy) {
        case 'priority':
          query = query.orderBy(sortOrder === 'desc' ? desc(promotions.priority) : asc(promotions.priority));
          break;
        case 'created_at':
          query = query.orderBy(sortOrder === 'desc' ? desc(promotions.created_at) : asc(promotions.created_at));
          break;
        case 'updated_at':
          query = query.orderBy(sortOrder === 'desc' ? desc(promotions.updated_at) : asc(promotions.updated_at));
          break;
        case 'name':
          query = query.orderBy(sortOrder === 'desc' ? desc(promotions.name) : asc(promotions.name));
          break;
        default:
          query = query.orderBy(sortOrder === 'desc' ? desc(promotions.priority) : asc(promotions.priority));
      }
    }

    // Apply pagination
    query = query.limit(limit).offset(offset);

    const results = await query;
    return results.map((result: any) => this.hydrateDatabasePromotion(result));
  }

  /**
   * Get active promotions for a specific context
   */
  async getActivePromotions(context?: PromotionEvaluationContext): Promise<MACHPromotion[]> {
    const now = new Date().toISOString();
    
    const activePromotions = await this.getPromotions({
      status: 'active',
      validOn: now,
      sortBy: 'priority',
      sortOrder: 'desc',
      limit: 1000
    });

    // Filter by eligibility if context provided
    if (context) {
      return activePromotions.filter(promotion => 
        this.evaluatePromotionEligibility(promotion, context)
      );
    }

    return activePromotions;
  }

  /**
   * Search promotions by text
   */
  async searchPromotions(searchTerm: string, options: PromotionFilterOptions = {}): Promise<MACHPromotion[]> {
    // For SQLite, we'll do a simple text search on name and description
    // In a production system, you might want to use full-text search
    const results = await this.db
      .select()
      .from(promotions)
      .where(
        or(
          sql`${promotions.name} LIKE ${'%' + searchTerm + '%'}`,
          sql`${promotions.description} LIKE ${'%' + searchTerm + '%'}`,
          sql`${promotions.slug} LIKE ${'%' + searchTerm + '%'}`
        )
      )
      .limit(options.limit || 50);

    return results.map((result: any) => this.hydrateDatabasePromotion(result));
  }

  // =====================================================
  // Business Logic Operations
  // =====================================================

  /**
   * Evaluate promotion eligibility for a given context
   */
  evaluatePromotionEligibility(promotion: MACHPromotion, context: PromotionEvaluationContext): boolean {
    try {
      // Check time validity
      if (!checkTimeValidity(promotion)) {
        return false;
      }

      // Check usage limits
      if (!checkUsageLimits(promotion, context)) {
        return false;
      }

      // Check promotion eligibility
      if (!checkPromotionEligibility(promotion, context)) {
        return false;
      }

      // Check rule conditions
      if (!evaluatePromotionConditions(promotion.rules, context)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error evaluating promotion eligibility for ${promotion.id}:`, error);
      return false;
    }
  }

  /**
   * Calculate discount amount for a promotion
   */
  calculatePromotionValue(promotion: MACHPromotion, context: PromotionEvaluationContext): number {
    if (!this.evaluatePromotionEligibility(promotion, context)) {
      return 0;
    }

    return calculatePromotionDiscount(promotion, context);
  }

  /**
   * Apply promotions to a cart/order context
   */
  async applyPromotions(context: PromotionEvaluationContext): Promise<{
    promotions: MACHPromotion[];
    totalDiscount: number;
    appliedPromotions: Array<{
      promotion: MACHPromotion;
      discount: number;
      description: string;
    }>;
  }> {
    // Get eligible promotions
    const activePromotions = await this.getActivePromotions(context);
    const eligiblePromotions = activePromotions.filter(promotion => 
      this.evaluatePromotionEligibility(promotion, context)
    );

    // Handle stacking rules
    const applicablePromotions = this.resolvePromotionStacking(eligiblePromotions);

    // Calculate discounts
    const appliedPromotions = applicablePromotions.map(promotion => {
      const discount = this.calculatePromotionValue(promotion, context);
      return {
        promotion,
        discount,
        description: this.getPromotionDescription(promotion, discount)
      };
    });

    const totalDiscount = appliedPromotions.reduce((sum, applied) => sum + applied.discount, 0);

    return {
      promotions: applicablePromotions,
      totalDiscount,
      appliedPromotions
    };
  }

  /**
   * Validate promotion code
   */
  async validatePromotionCode(code: string, context?: PromotionEvaluationContext): Promise<MACHPromotion | null> {
    // Search for promotions with this code
    const codePromotions = await this.getPromotions({
      activationMethod: 'code',
      status: 'active',
      limit: 1000
    });

    // Find promotion with matching code
    const matchingPromotion = codePromotions.find(promotion => {
      if (!promotion.codes) return false;
      
      // Check single code
      if (promotion.codes.single_code === code) return true;
      
      // Check coupon instances
      if (promotion.codes.coupon_instances?.includes(code)) return true;
      
      return false;
    });

    if (!matchingPromotion) {
      return null;
    }

    // Check eligibility if context provided
    if (context && !this.evaluatePromotionEligibility(matchingPromotion, context)) {
      return null;
    }

    return matchingPromotion;
  }

  /**
   * Generate promotion codes
   */
  async generatePromotionCodes(promotionId: string, count: number = 1): Promise<string[]> {
    const promotion = await this.getPromotionById(promotionId);
    if (!promotion) {
      throw new Error(`Promotion with ID ${promotionId} not found`);
    }

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(generatePromotionCode());
    }

    // Update promotion with new codes
    const updatedCodes = {
      ...promotion.codes,
      coupon_instances: [...(promotion.codes?.coupon_instances || []), ...codes]
    };

    await this.updatePromotion(promotionId, { codes: updatedCodes });

    return codes;
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  /**
   * Resolve promotion stacking rules
   */
  private resolvePromotionStacking(promotions: MACHPromotion[]): MACHPromotion[] {
    // Sort by priority (highest first)
    const sortedPromotions = [...promotions].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    const applicable: MACHPromotion[] = [];
    let hasNonStackable = false;

    for (const promotion of sortedPromotions) {
      // If we already have a non-stackable promotion, skip others
      if (hasNonStackable) {
        break;
      }

      // Add this promotion
      applicable.push(promotion);

      // Check if this promotion is stackable
      if (!promotion.stackable) {
        hasNonStackable = true;
      }
    }

    return applicable;
  }

  /**
   * Get promotion description for display
   */
  private getPromotionDescription(promotion: MACHPromotion, discount: number): string {
    const name = typeof promotion.name === 'string' ? promotion.name : promotion.name?.en || 'Promotion';
    
    if (discount === 0) {
      return name;
    }

    // Format discount amount
    const formattedDiscount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(discount / 100); // Assuming cents

    return `${name} (-${formattedDiscount})`;
  }

  /**
   * Hydrate database promotion record to MACHPromotion
   */
  private hydrateDatabasePromotion(record: any): MACHPromotion {
    try {
      const hydrated: MACHPromotion = {
        id: record.id,
        name: this.parseJsonField(record.name) || record.name,
        type: record.type as MACHPromotionType,
        rules: this.parseJsonField(record.rules),
        status: record.status as MACHPromotionStatus,
        description: this.parseJsonField(record.description) || record.description,
        slug: record.slug,
        external_references: this.parseJsonField(record.external_references),
        created_at: record.created_at,
        updated_at: record.updated_at,
        valid_from: record.valid_from,
        valid_to: record.valid_to,
        activation_method: record.activation_method as PromotionActivationMethod,
        codes: this.parseJsonField(record.codes),
        usage_limits: this.parseJsonField(record.usage_limits),
        eligibility: this.parseJsonField(record.eligibility),
        priority: record.priority,
        stackable: record.stackable === 1,
        extensions: this.parseJsonField(record.extensions)
      };

      // Remove undefined fields
      Object.keys(hydrated).forEach(key => {
        if ((hydrated as any)[key] === undefined || (hydrated as any)[key] === null) {
          delete (hydrated as any)[key];
        }
      });

      return hydrated;
    } catch (error) {
      console.error("Error hydrating promotion:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to hydrate promotion record: ${errorMessage}`);
    }
  }

  /**
   * Parse JSON field safely
   */
  private parseJsonField(field: any): any {
    if (!field) return undefined;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    }
    return field;
  }

  // Database connection
  constructor(private db: any) {}
}

// Factory function to create model with database connection
export function createPromotionModel(db: any) {
  return new PromotionModel(db);
}

// Export for external use
export default PromotionModel;
