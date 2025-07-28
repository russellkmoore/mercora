// Temporary ChatSession class for migration purposes
export class ChatSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response("Migration in progress", { status: 503 });
  }
}
