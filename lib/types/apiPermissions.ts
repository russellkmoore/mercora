// API permissions for unified auth
export const API_PERMISSIONS = {
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  ORDERS_READ: 'orders:read', 
  ORDERS_WRITE: 'orders:write',
  ORDERS_UPDATE_STATUS: 'orders:update_status',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  ADMIN_ALL: 'admin:all',
  VECTORIZE_MANAGE: 'vectorize:manage',
} as const;

export type ApiPermission = typeof API_PERMISSIONS[keyof typeof API_PERMISSIONS];
