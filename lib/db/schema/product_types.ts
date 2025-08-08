/**
 * MACH Alliance ProductType Entity - Database Schema
 * Drizzle ORM schema for MACH compliant ProductType entity
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { 
  MACHProductType,
  MACHAttributeDefinition,
  MACHAttributeValidation,
  MACHAttributeOption
} from '../../types/mach/ProductType.js';

// Main product_types table
export const product_types = sqliteTable('product_types', {
  id: text('id').primaryKey(),
  name: text('name', { mode: 'json' }).$type<string | Record<string, string>>().notNull(),
  attribute_definitions: text('attribute_definitions', { mode: 'json' }).$type<Record<string, MACHAttributeDefinition>>().notNull(),
  status: text('status', { enum: ['active', 'inactive', 'deprecated'] }).default('active'),
  external_references: text('external_references', { mode: 'json' }).$type<Record<string, string>>(),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
  description: text('description', { mode: 'json' }).$type<string | Record<string, string>>(),
  parent_type_id: text('parent_type_id'),
  required_attributes: text('required_attributes', { mode: 'json' }).$type<string[]>(),
  category_path: text('category_path', { mode: 'json' }).$type<string[]>(),
  version: text('version'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  applicable_channels: text('applicable_channels', { mode: 'json' }).$type<string[]>(),
  applicable_regions: text('applicable_regions', { mode: 'json' }).$type<string[]>(),
  extensions: text('extensions', { mode: 'json' }).$type<Record<string, any>>()
});

/**
 * Schema validation and transformation utilities
 */

export function validateProductType(data: any): data is MACHProductType {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    (typeof data.name === 'string' || (typeof data.name === 'object' && data.name !== null)) &&
    typeof data.attribute_definitions === 'object' &&
    data.attribute_definitions !== null
  );
}

export function validateAttributeDefinition(data: any): data is MACHAttributeDefinition {
  const validTypes = [
    'text', 'number', 'boolean', 'date', 'datetime',
    'select', 'multiselect', 'money', 'dimension',
    'weight', 'url', 'email', 'json', 'rich_text'
  ];

  return (
    typeof data === 'object' &&
    validTypes.includes(data.type) &&
    (typeof data.label === 'string' || (typeof data.label === 'object' && data.label !== null))
  );
}

export function transformProductTypeForDB(productType: MACHProductType) {
  return {
    ...productType,
    created_at: productType.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * ProductType utility functions
 */

export function isActiveProductType(productType: MACHProductType): boolean {
  return productType.status === 'active' || productType.status === undefined;
}

export function isDeprecatedProductType(productType: MACHProductType): boolean {
  return productType.status === 'deprecated';
}

export function hasParentType(productType: MACHProductType): boolean {
  return productType.parent_type_id !== undefined && productType.parent_type_id !== null;
}

export function hasRequiredAttributes(productType: MACHProductType): boolean {
  return productType.required_attributes !== undefined && productType.required_attributes.length > 0;
}

export function getRequiredAttributes(productType: MACHProductType): string[] {
  return productType.required_attributes || [];
}

export function getAttributeDefinition(
  productType: MACHProductType,
  attributeId: string
): MACHAttributeDefinition | undefined {
  return productType.attribute_definitions[attributeId];
}

export function isRequiredAttribute(productType: MACHProductType, attributeId: string): boolean {
  const requiredAttrs = productType.required_attributes || [];
  return requiredAttrs.includes(attributeId);
}

export function isVariantDefiningAttribute(
  productType: MACHProductType,
  attributeId: string
): boolean {
  const attr = productType.attribute_definitions[attributeId];
  return attr?.is_variant_defining === true;
}

export function getSelectOptions(
  productType: MACHProductType,
  attributeId: string
): MACHAttributeOption[] {
  const attr = productType.attribute_definitions[attributeId];
  if (!attr || (attr.type !== 'select' && attr.type !== 'multiselect')) {
    return [];
  }
  return attr.options || [];
}

export function validateAttributeValue(
  productType: MACHProductType,
  attributeId: string,
  value: any
): { isValid: boolean; error?: string } {
  const attr = productType.attribute_definitions[attributeId];
  if (!attr) {
    return { isValid: false, error: 'Attribute definition not found' };
  }

  // Check if required attribute has a value
  if (isRequiredAttribute(productType, attributeId) && (value === null || value === undefined || value === '')) {
    return { isValid: false, error: 'Required attribute cannot be empty' };
  }

  // Type-specific validation
  switch (attr.type) {
    case 'text':
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Value must be a string' };
      }
      break;
    
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { isValid: false, error: 'Value must be a valid number' };
      }
      break;
    
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { isValid: false, error: 'Value must be a boolean' };
      }
      break;
    
    case 'select':
      const selectOptions = getSelectOptions(productType, attributeId);
      const validValues = selectOptions.map(opt => opt.value);
      if (!validValues.includes(value)) {
        return { isValid: false, error: `Value must be one of: ${validValues.join(', ')}` };
      }
      break;
    
    case 'multiselect':
      if (!Array.isArray(value)) {
        return { isValid: false, error: 'Value must be an array' };
      }
      const multiselectOptions = getSelectOptions(productType, attributeId);
      const validMultiValues = multiselectOptions.map(opt => opt.value);
      for (const val of value) {
        if (!validMultiValues.includes(val)) {
          return { isValid: false, error: `All values must be from: ${validMultiValues.join(', ')}` };
        }
      }
      break;
    
    case 'date':
    case 'datetime':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: 'Value must be a valid date' };
      }
      break;
  }

  // Validation rules
  if (attr.validation) {
    const validation = attr.validation;
    
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return { isValid: false, error: `Value does not match required pattern: ${validation.pattern}` };
      }
    }
    
    if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
      return { isValid: false, error: `Value must be at least ${validation.min}` };
    }
    
    if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
      return { isValid: false, error: `Value must be at most ${validation.max}` };
    }
    
    if (validation.min_length !== undefined && typeof value === 'string' && value.length < validation.min_length) {
      return { isValid: false, error: `Value must be at least ${validation.min_length} characters long` };
    }
    
    if (validation.max_length !== undefined && typeof value === 'string' && value.length > validation.max_length) {
      return { isValid: false, error: `Value must be at most ${validation.max_length} characters long` };
    }
    
    if (validation.allowed_values && !validation.allowed_values.includes(value)) {
      return { isValid: false, error: `Value must be one of: ${validation.allowed_values.join(', ')}` };
    }
  }

  return { isValid: true };
}

export function getInheritedAttributes(
  productType: MACHProductType,
  allProductTypes: MACHProductType[]
): Record<string, MACHAttributeDefinition> {
  const inheritedAttributes: Record<string, MACHAttributeDefinition> = {};
  
  // Start with current type's attributes
  Object.assign(inheritedAttributes, productType.attribute_definitions);
  
  // Walk up the inheritance chain
  let currentType = productType;
  while (currentType.parent_type_id) {
    const parentType = allProductTypes.find(pt => pt.id === currentType.parent_type_id);
    if (!parentType) break;
    
    // Add parent attributes that don't exist in child
    for (const [attrId, attrDef] of Object.entries(parentType.attribute_definitions)) {
      if (!inheritedAttributes[attrId]) {
        inheritedAttributes[attrId] = attrDef;
      }
    }
    
    currentType = parentType;
  }
  
  return inheritedAttributes;
}

export function getInheritedRequiredAttributes(
  productType: MACHProductType,
  allProductTypes: MACHProductType[]
): string[] {
  const requiredAttributes = new Set<string>(productType.required_attributes || []);
  
  // Walk up the inheritance chain
  let currentType = productType;
  while (currentType.parent_type_id) {
    const parentType = allProductTypes.find(pt => pt.id === currentType.parent_type_id);
    if (!parentType) break;
    
    // Add parent required attributes
    for (const attrId of parentType.required_attributes || []) {
      requiredAttributes.add(attrId);
    }
    
    currentType = parentType;
  }
  
  return Array.from(requiredAttributes);
}

export function getVariantDefiningAttributes(productType: MACHProductType): string[] {
  const variantDefiningAttrs: string[] = [];
  
  for (const [attrId, attrDef] of Object.entries(productType.attribute_definitions)) {
    if (attrDef.is_variant_defining) {
      variantDefiningAttrs.push(attrId);
    }
  }
  
  return variantDefiningAttrs;
}

export function getSearchableAttributes(productType: MACHProductType): string[] {
  const searchableAttrs: string[] = [];
  
  for (const [attrId, attrDef] of Object.entries(productType.attribute_definitions)) {
    if (attrDef.is_searchable !== false) { // Default to true
      searchableAttrs.push(attrId);
    }
  }
  
  return searchableAttrs;
}

export function buildProductTypeHierarchy(productTypes: MACHProductType[]): {
  roots: MACHProductType[];
  children: Record<string, MACHProductType[]>;
} {
  const roots: MACHProductType[] = [];
  const children: Record<string, MACHProductType[]> = {};
  
  for (const productType of productTypes) {
    if (!productType.parent_type_id) {
      roots.push(productType);
    } else {
      if (!children[productType.parent_type_id]) {
        children[productType.parent_type_id] = [];
      }
      children[productType.parent_type_id].push(productType);
    }
  }
  
  return { roots, children };
}

export function getLocalizedValue(
  value: string | Record<string, string> | undefined,
  locale: string = 'en-US'
): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value[locale] || value[Object.keys(value)[0]];
}

export function isProductTypeLocalized(productType: MACHProductType): boolean {
  return typeof productType.name === 'object' || typeof productType.description === 'object';
}

export function generateProductTypeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
