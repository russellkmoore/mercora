export {};

declare global {
  namespace Cloudflare {
    interface Env extends ObservabilityTailEnv {}
  }
}
