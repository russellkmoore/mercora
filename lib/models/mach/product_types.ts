/**
 * MACH Alliance ProductType Entity - Business Model
 * Complete business logic layer for MACH compliant ProductType entity
 */

import { eq, and, or, isNull, isNotNull, like, desc, asc, inArray } from 'drizzle-orm';
import { getDb } from '../../db';
import { product_types } from '../../db/schema/product_types';
import { 
  type MACHProductType,
  type MACHAttributeDefinition,
  type MACHAttributeValidation,
  type MACHAttributeOption
} from '../../types/mach/ProductType';
import {
  validateProductType,
  validateAttributeDefinition,
  transformProductTypeForDB,
  isActiveProductType,
  isDeprecatedProductType,
  hasParentType,
  hasRequiredAttributes,
  getRequiredAttributes,
  getAttributeDefinition,
  isRequiredAttribute,
  isVariantDefiningAttribute,
  getSelectOptions,
  validateAttributeValue,
  getInheritedAttributes,
  getInheritedRequiredAttributes,
  getVariantDefiningAttributes,
  getSearchableAttributes,
  buildProductTypeHierarchy,
  getLocalizedValue,
  isProductTypeLocalized,
  generateProductTypeSlug
} from '../../db/schema/product_types';

/**
 * ProductType Model - Business operations for product type management
 */

// Type conversion helper to handle database null vs TypeScript undefined
function dbToMACHProductType(dbRow: any): MACHProductType {
  return {
    ...dbRow,
    status: dbRow.status ?? undefined,
    external_references: dbRow.external_references ?? undefined,
    created_at: dbRow.created_at ?? undefined,
    updated_at: dbRow.updated_at ?? undefined,
    description: dbRow.description ?? undefined,
    parent_type_id: dbRow.parent_type_id ?? undefined,
    required_attributes: dbRow.required_attributes ?? undefined,
    category_path: dbRow.category_path ?? undefined,
    version: dbRow.version ?? undefined,
    tags: dbRow.tags ?? undefined,
    applicable_channels: dbRow.applicable_channels ?? undefined,
    applicable_regions: dbRow.applicable_regions ?? undefined,
    extensions: dbRow.extensions ?? undefined
  } as MACHProductType;
}

function dbToMACHProductTypes(dbRows: any[]): MACHProductType[] {
  return dbRows.map(dbToMACHProductType);
}

export class ProductTypeModel {
  /**
   * Create a new product type
   */
  static async create(productTypeData: MACHProductType): Promise<MACHProductType> {
    const db = getDb();
    
    if (!validateProductType(productTypeData)) {
      throw new Error('Invalid product type data');
    }

    // Validate all attribute definitions
    for (const [attrId, attrDef] of Object.entries(productTypeData.attribute_definitions)) {
      if (!validateAttributeDefinition(attrDef)) {
        throw new Error(`Invalid attribute definition for '${attrId}'`);
      }
    }

    // Validate parent type exists if specified
    if (productTypeData.parent_type_id) {
      const parentType = await this.findById(productTypeData.parent_type_id);
      if (!parentType) {
        throw new Error(`Parent type '${productTypeData.parent_type_id}' not found`);
      }
      if (!isActiveProductType(parentType)) {
        throw new Error('Parent type must be active');
      }
    }

    const transformedData = transformProductTypeForDB(productTypeData);
    
    try {
      await db.insert(product_types).values(transformedData);
      return transformedData;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Product type with ID '${productTypeData.id}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Find product type by ID
   */
  static async findById(id: string): Promise<MACHProductType | null> {
    const db = getDb();
    const result = await db.select().from(product_types).where(eq(product_types.id, id)).limit(1);
    return result[0] ? dbToMACHProductType(result[0]) : null;
  }

  /**
   * Find product types by IDs
   */
  static async findByIds(ids: string[]): Promise<MACHProductType[]> {
    if (ids.length === 0) return [];
    const db = getDb();
    const result = await db.select().from(product_types).where(inArray(product_types.id, ids));
    return dbToMACHProductTypes(result);
  }

  /**
   * Find active product types
   */
  static async findActive(options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<MACHProductType[]> {
    const db = getDb();
    const query = db.select()
      .from(product_types)
      .where(eq(product_types.status, 'active'))
      .orderBy(asc(product_types.name));

    if (options.limit) {
      query.limit(options.limit);
    }
    if (options.offset) {
      query.offset(options.offset);
    }

    const result = await query;
    return dbToMACHProductTypes(result);
  }

  /**
   * Find product types by parent
   */
  static async findByParent(parentId: string | null): Promise<MACHProductType[]> {
    const db = getDb();
    const whereClause = parentId ? eq(product_types.parent_type_id, parentId) : isNull(product_types.parent_type_id);
    
    const result = await db.select()
      .from(product_types)
      .where(whereClause)
      .orderBy(asc(product_types.name));
      
    return dbToMACHProductTypes(result);
  }

  /**
   * Find root product types (no parent)
   */
  static async findRoots(): Promise<MACHProductType[]> {
    return this.findByParent(null);
  }

  /**
   * Find children of a product type
   */
  static async findChildren(parentId: string): Promise<MACHProductType[]> {
    return this.findByParent(parentId);
  }

  /**
   * Find product types by status
   */
  static async findByStatus(status: 'active' | 'inactive' | 'deprecated'): Promise<MACHProductType[]> {
    const db = getDb();
    const result = await db.select()
      .from(product_types)
      .where(eq(product_types.status, status))
      .orderBy(asc(product_types.name));
      
    return dbToMACHProductTypes(result);
  }

  /**
   * Search product types by name
   */
  static async searchByName(
    searchTerm: string,
    options: {
      status?: 'active' | 'inactive' | 'deprecated';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MACHProductType[]> {
    const db = getDb();
    let whereConditions: any[] = [like(product_types.name, `%${searchTerm}%`)];
    
    if (options.status) {
      whereConditions.push(eq(product_types.status, options.status));
    }

    const query = db.select()
      .from(product_types)
      .where(and(...whereConditions))
      .orderBy(asc(product_types.name));

    if (options.limit) {
      query.limit(options.limit);
    }
    if (options.offset) {
      query.offset(options.offset);
    }

    const result = await query;
    return dbToMACHProductTypes(result);
  }

  /**
   * Update a product type
   */
  static async update(id: string, updateData: Partial<MACHProductType>): Promise<MACHProductType | null> {
    const db = getDb();
    const existingProductType = await this.findById(id);
    if (!existingProductType) {
      throw new Error(`Product type '${id}' not found`);
    }

    const updatedData = {
      ...existingProductType,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    if (!validateProductType(updatedData)) {
      throw new Error('Invalid product type data after update');
    }

    // Validate parent type if being changed
    if (updateData.parent_type_id !== undefined && updateData.parent_type_id !== existingProductType.parent_type_id) {
      if (updateData.parent_type_id) {
        const parentType = await this.findById(updateData.parent_type_id);
        if (!parentType) {
          throw new Error(`Parent type '${updateData.parent_type_id}' not found`);
        }
        if (!isActiveProductType(parentType)) {
          throw new Error('Parent type must be active');
        }
        // Prevent circular references
        if (await this.wouldCreateCircularReference(id, updateData.parent_type_id)) {
          throw new Error('Cannot create circular reference in type hierarchy');
        }
      }
    }

    // Validate attribute definitions if being changed
    if (updateData.attribute_definitions) {
      for (const [attrId, attrDef] of Object.entries(updateData.attribute_definitions)) {
        if (!validateAttributeDefinition(attrDef)) {
          throw new Error(`Invalid attribute definition for '${attrId}'`);
        }
      }
    }

    await db.update(product_types)
      .set(updatedData)
      .where(eq(product_types.id, id));

    return updatedData;
  }

  /**
   * Delete a product type (soft delete by setting status to deprecated)
   */
  static async delete(id: string): Promise<boolean> {
    const db = getDb();
    const existingProductType = await this.findById(id);
    if (!existingProductType) {
      return false;
    }

    // Check if this type has children
    const children = await this.findChildren(id);
    if (children.length > 0) {
      throw new Error('Cannot delete product type that has child types');
    }

    await db.update(product_types)
      .set({ 
        status: 'deprecated',
        updated_at: new Date().toISOString()
      })
      .where(eq(product_types.id, id));

    return true;
  }

  /**
   * Hard delete a product type (permanent removal)
   */
  static async hardDelete(id: string): Promise<boolean> {
    const db = getDb();
    const existingProductType = await this.findById(id);
    if (!existingProductType) {
      return false;
    }

    // Check if this type has children
    const children = await this.findChildren(id);
    if (children.length > 0) {
      throw new Error('Cannot delete product type that has child types');
    }

    const result = await db.delete(product_types)
      .where(eq(product_types.id, id));

    return result.meta.changes > 0;
  }

  /**
   * Count product types by status
   */
  static async countByStatus(): Promise<Record<string, number>> {
    const db = getDb();
    const result = await db.select().from(product_types);
    const allTypes = dbToMACHProductTypes(result);
    
    const counts = {
      active: 0,
      inactive: 0,
      deprecated: 0,
      total: allTypes.length
    };

    for (const productType of allTypes) {
      if (productType.status && counts.hasOwnProperty(productType.status)) {
        counts[productType.status as keyof typeof counts]++;
      }
    }

    return counts;
  }

  /**
   * Get full product type hierarchy
   */
  static async getHierarchy(): Promise<{
    roots: MACHProductType[];
    children: Record<string, MACHProductType[]>;
  }> {
    const db = getDb();
    const result = await db.select().from(product_types);
    const allProductTypes = dbToMACHProductTypes(result);
    return buildProductTypeHierarchy(allProductTypes);
  }

  /**
   * Get ancestors of a product type (walk up the hierarchy)
   */
  static async getAncestors(id: string): Promise<MACHProductType[]> {
    const db = getDb();
    const ancestors: MACHProductType[] = [];
    const result = await db.select().from(product_types);
    const allTypes = dbToMACHProductTypes(result);
    
    let currentType = allTypes.find((t: MACHProductType) => t.id === id);
    while (currentType?.parent_type_id) {
      const parent = allTypes.find((t: MACHProductType) => t.id === currentType!.parent_type_id);
      if (!parent) break;
      ancestors.push(parent);
      currentType = parent;
    }
    
    return ancestors;
  }

  /**
   * Get descendants of a product type (walk down the hierarchy)
   */
  static async getDescendants(id: string): Promise<MACHProductType[]> {
    const db = getDb();
    const descendants: MACHProductType[] = [];
    const result = await db.select().from(product_types);
    const allTypes = dbToMACHProductTypes(result);
    const { children } = buildProductTypeHierarchy(allTypes);
    
    const addDescendants = (parentId: string) => {
      const childTypes = children[parentId] || [];
      for (const child of childTypes) {
        descendants.push(child);
        addDescendants(child.id);
      }
    };
    
    addDescendants(id);
    return descendants;
  }

  /**
   * Get inherited attributes for a product type
   */
  static async getInheritedAttributesForType(id: string): Promise<Record<string, MACHAttributeDefinition>> {
    const db = getDb();
    const productType = await this.findById(id);
    if (!productType) {
      throw new Error(`Product type '${id}' not found`);
    }

    const result = await db.select().from(product_types);
    const allProductTypes = dbToMACHProductTypes(result);
    return getInheritedAttributes(productType, allProductTypes);
  }

  /**
   * Get inherited required attributes for a product type
   */
  static async getInheritedRequiredAttributesForType(id: string): Promise<string[]> {
    const db = getDb();
    const productType = await this.findById(id);
    if (!productType) {
      throw new Error(`Product type '${id}' not found`);
    }

    const result = await db.select().from(product_types);
    const allProductTypes = dbToMACHProductTypes(result);
    return getInheritedRequiredAttributes(productType, allProductTypes);
  }

  /**
   * Validate attribute value against product type definition
   */
  static async validateProductAttribute(
    productTypeId: string,
    attributeId: string,
    value: any
  ): Promise<{ isValid: boolean; error?: string }> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return { isValid: false, error: 'Product type not found' };
    }

    return validateAttributeValue(productType, attributeId, value);
  }

  /**
   * Get attribute definition for a product type
   */
  static async getAttributeDefinitionForType(
    productTypeId: string,
    attributeId: string
  ): Promise<MACHAttributeDefinition | null> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return null;
    }

    return getAttributeDefinition(productType, attributeId) || null;
  }

  /**
   * Get select options for an attribute
   */
  static async getAttributeSelectOptions(
    productTypeId: string,
    attributeId: string
  ): Promise<MACHAttributeOption[]> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return [];
    }

    return getSelectOptions(productType, attributeId);
  }

  /**
   * Check if attribute is required for a product type
   */
  static async isAttributeRequired(productTypeId: string, attributeId: string): Promise<boolean> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return false;
    }

    return isRequiredAttribute(productType, attributeId);
  }

  /**
   * Check if attribute defines variants for a product type
   */
  static async isAttributeVariantDefining(productTypeId: string, attributeId: string): Promise<boolean> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return false;
    }

    return isVariantDefiningAttribute(productType, attributeId);
  }

  /**
   * Get all variant-defining attributes for a product type
   */
  static async getVariantDefiningAttributesForType(productTypeId: string): Promise<string[]> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return [];
    }

    return getVariantDefiningAttributes(productType);
  }

  /**
   * Get all searchable attributes for a product type
   */
  static async getSearchableAttributesForType(productTypeId: string): Promise<string[]> {
    const productType = await this.findById(productTypeId);
    if (!productType) {
      return [];
    }

    return getSearchableAttributes(productType);
  }

  /**
   * Check if setting parent would create circular reference
   */
  private static async wouldCreateCircularReference(childId: string, newParentId: string): Promise<boolean> {
    const descendants = await this.getDescendants(childId);
    return descendants.some(descendant => descendant.id === newParentId);
  }

  /**
   * Clone a product type with modifications
   */
  static async clone(
    sourceId: string, 
    newId: string, 
    modifications: Partial<MACHProductType> = {}
  ): Promise<MACHProductType> {
    const sourceType = await this.findById(sourceId);
    if (!sourceType) {
      throw new Error(`Source product type '${sourceId}' not found`);
    }

    const clonedData: MACHProductType = {
      ...sourceType,
      ...modifications,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Clear parent reference unless explicitly set
      parent_type_id: modifications.parent_type_id !== undefined ? modifications.parent_type_id : undefined
    };

    return await this.create(clonedData);
  }

  /**
   * Batch operations for product types
   */
  static async batchUpdate(
    updates: Array<{ id: string; data: Partial<MACHProductType> }>
  ): Promise<MACHProductType[]> {
    const results: MACHProductType[] = [];
    
    for (const update of updates) {
      try {
        const updated = await this.update(update.id, update.data);
        if (updated) {
          results.push(updated);
        }
      } catch (error) {
        console.error(`Failed to update product type ${update.id}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get localized name for a product type
   */
  static getLocalizedName(productType: MACHProductType, locale: string = 'en-US'): string {
    const name = getLocalizedValue(
      typeof productType.name === 'string' ? productType.name : productType.name as Record<string, string>,
      locale
    );
    return name || productType.id;
  }

  /**
   * Get localized description for a product type
   */
  static getLocalizedDescription(productType: MACHProductType, locale: string = 'en-US'): string | undefined {
    if (!productType.description) return undefined;
    return getLocalizedValue(
      typeof productType.description === 'string' ? productType.description : productType.description as Record<string, string>,
      locale
    );
  }

  /**
   * Generate URL-friendly slug for product type
   */
  static generateSlug(name: string): string {
    return generateProductTypeSlug(name);
  }

  /**
   * Find product types applicable to a channel
   */
  static async findByChannel(channelId: string): Promise<MACHProductType[]> {
    const db = getDb();
    const result = await db.select().from(product_types);
    const allTypes = dbToMACHProductTypes(result);
    return allTypes.filter((type: MACHProductType) => {
      if (!type.applicable_channels) return true; // No restrictions
      const channels = Array.isArray(type.applicable_channels) ? type.applicable_channels : [];
      return channels.includes(channelId);
    });
  }

  /**
   * Find product types applicable to a region
   */
  static async findByRegion(regionId: string): Promise<MACHProductType[]> {
    const db = getDb();
    const result = await db.select().from(product_types);
    const allTypes = dbToMACHProductTypes(result);
    return allTypes.filter((type: MACHProductType) => {
      if (!type.applicable_regions) return true; // No restrictions
      const regions = Array.isArray(type.applicable_regions) ? type.applicable_regions : [];
      return regions.includes(regionId);
    });
  }

  /**
   * Export product type with full hierarchy context
   */
  static async exportWithContext(id: string): Promise<{
    productType: MACHProductType;
    ancestors: MACHProductType[];
    descendants: MACHProductType[];
    inheritedAttributes: Record<string, MACHAttributeDefinition>;
    inheritedRequiredAttributes: string[];
  }> {
    const productType = await this.findById(id);
    if (!productType) {
      throw new Error(`Product type '${id}' not found`);
    }

    const [ancestors, descendants, inheritedAttributes, inheritedRequiredAttributes] = await Promise.all([
      this.getAncestors(id),
      this.getDescendants(id),
      this.getInheritedAttributesForType(id),
      this.getInheritedRequiredAttributesForType(id)
    ]);

    return {
      productType,
      ancestors,
      descendants,
      inheritedAttributes,
      inheritedRequiredAttributes
    };
  }
}

/**
 * Utility functions for ProductType operations
 */

export const ProductTypeUtils = {
  /**
   * Validate a complete product against its product type
   */
  validateProduct: async (
    productTypeId: string,
    productAttributes: Record<string, any>
  ): Promise<{ isValid: boolean; errors: string[] }> => {
    const errors: string[] = [];
    
    try {
      const requiredAttributes = await ProductTypeModel.getInheritedRequiredAttributesForType(productTypeId);
      const inheritedAttributes = await ProductTypeModel.getInheritedAttributesForType(productTypeId);

      // Check required attributes
      for (const requiredAttr of requiredAttributes) {
        if (!(requiredAttr in productAttributes) || 
            productAttributes[requiredAttr] === null || 
            productAttributes[requiredAttr] === undefined || 
            productAttributes[requiredAttr] === '') {
          errors.push(`Required attribute '${requiredAttr}' is missing or empty`);
        }
      }

      // Validate each provided attribute
      for (const [attrId, value] of Object.entries(productAttributes)) {
        if (inheritedAttributes[attrId]) {
          const validation = await ProductTypeModel.validateProductAttribute(productTypeId, attrId, value);
          if (!validation.isValid && validation.error) {
            errors.push(`Attribute '${attrId}': ${validation.error}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  },

  /**
   * Get attribute summary for a product type
   */
  getAttributeSummary: async (productTypeId: string): Promise<{
    total: number;
    required: number;
    variantDefining: number;
    searchable: number;
    byType: Record<string, number>;
  }> => {
    const inheritedAttributes = await ProductTypeModel.getInheritedAttributesForType(productTypeId);
    const requiredAttributes = await ProductTypeModel.getInheritedRequiredAttributesForType(productTypeId);
    const variantDefiningAttributes = await ProductTypeModel.getVariantDefiningAttributesForType(productTypeId);
    const searchableAttributes = await ProductTypeModel.getSearchableAttributesForType(productTypeId);

    const byType: Record<string, number> = {};
    for (const attr of Object.values(inheritedAttributes)) {
      byType[attr.type] = (byType[attr.type] || 0) + 1;
    }

    return {
      total: Object.keys(inheritedAttributes).length,
      required: requiredAttributes.length,
      variantDefining: variantDefiningAttributes.length,
      searchable: searchableAttributes.length,
      byType
    };
  },

  /**
   * Find optimal parent for a product type based on attribute overlap
   */
  findOptimalParent: async (
    candidateAttributes: Record<string, MACHAttributeDefinition>
  ): Promise<{ productType: MACHProductType; overlapScore: number } | null> => {
    const allTypes = await ProductTypeModel.findActive();
    let bestMatch: { productType: MACHProductType; overlapScore: number } | null = null;

    for (const productType of allTypes) {
      const inheritedAttributes = await ProductTypeModel.getInheritedAttributesForType(productType.id);
      
      let overlapCount = 0;
      let totalCandidate = Object.keys(candidateAttributes).length;
      
      for (const [attrId, attrDef] of Object.entries(candidateAttributes)) {
        const inheritedAttr = inheritedAttributes[attrId];
        if (inheritedAttr && inheritedAttr.type === attrDef.type) {
          overlapCount++;
        }
      }

      const overlapScore = totalCandidate > 0 ? overlapCount / totalCandidate : 0;
      
      if (!bestMatch || overlapScore > bestMatch.overlapScore) {
        bestMatch = { productType, overlapScore };
      }
    }

    return bestMatch && bestMatch.overlapScore > 0.3 ? bestMatch : null;
  }
};
