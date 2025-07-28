export default {
  async fetch(request, env) {
    // This migration deletes all ChatSession Durable Objects
    return new Response("ChatSession class deleted", { status: 200 });
  }
};

// Export deleted class for migration
export const deleted_classes = ["ChatSession"];
