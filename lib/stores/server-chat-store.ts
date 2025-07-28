// Simple in-memory chat store for server-side use
// This avoids the localStorage persistence issue in Cloudflare Workers

type ChatMessage = {
  role?: "user" | "assistant";
  content: string;
  created_at: string;
  productIds?: number[];
};

// Session-based storage using userId as key
const userSessions = new Map<string, ChatMessage[]>();

export const addMessage = (msg: ChatMessage, userId?: string) => {
  const sessionId = userId || 'anonymous';
  if (!userSessions.has(sessionId)) {
    userSessions.set(sessionId, []);
  }
  userSessions.get(sessionId)!.push(msg);
};

export const getMessages = (userId?: string) => {
  const sessionId = userId || 'anonymous';
  return [...(userSessions.get(sessionId) || [])];
};

export const clearMessages = (userId?: string) => {
  const sessionId = userId || 'anonymous';
  userSessions.set(sessionId, []);
};
