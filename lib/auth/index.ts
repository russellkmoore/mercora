// lib/auth/index.ts
// Re-export all authentication-related functions and types

export {
  authenticateRequest,
  PERMISSIONS,
  type AuthResult,
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
