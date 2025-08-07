// lib/auth/index.ts
// Re-export all authentication-related functions and types

export {
  authenticateRequest,
  withAuth,
  generateApiToken,
  storeApiToken,
  revokeApiToken,
  PERMISSIONS,
  type AuthResult,
  type TokenPermissions,
} from "./unified-auth";

export {
  apiTokens,
  insertApiToken,
  getApiTokenByHash,
  getApiTokenByName,
  getAllApiTokens,
  updateApiTokenLastUsed,
  deleteExpiredTokens,
} from "../models/auth";
