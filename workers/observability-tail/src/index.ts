import { processTailEvents } from './handler';

export { AlertCooldown } from './alert-cooldown';

export default {
  async tail(events, env): Promise<void> {
    await processTailEvents(events, env);
  },
} satisfies ExportedHandler<ObservabilityTailEnv>;
