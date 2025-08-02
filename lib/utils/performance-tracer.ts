/**
 * Performance tracing utility for Cloudflare Workers
 * 
 * Provides detailed timing measurements with hierarchical context
 * and automatic console output formatting.
 */

export class PerformanceTracer {
  private startTime: number;
  private marks: Map<string, number> = new Map();
  private context: string;
  
  constructor(context: string) {
    this.context = context;
    this.startTime = Date.now();
    console.log(`🚀 [${this.context}] Starting trace`);
  }
  
  mark(label: string): void {
    const now = Date.now();
    const elapsed = now - this.startTime;
    this.marks.set(label, now);
    console.log(`⏱️  [${this.context}] ${label}: +${elapsed}ms`);
  }
  
  measure(label: string, startMark?: string): number {
    const now = Date.now();
    const startTime = startMark ? this.marks.get(startMark) || this.startTime : this.startTime;
    const duration = now - startTime;
    console.log(`📊 [${this.context}] ${label}: ${duration}ms`);
    return duration;
  }
  
  finish(): number {
    const totalTime = Date.now() - this.startTime;
    console.log(`✅ [${this.context}] Total: ${totalTime}ms`);
    return totalTime;
  }
  
  static async trace<T>(context: string, fn: (tracer: PerformanceTracer) => Promise<T>): Promise<T> {
    const tracer = new PerformanceTracer(context);
    try {
      const result = await fn(tracer);
      tracer.finish();
      return result;
    } catch (error) {
      console.error(`❌ [${context}] Error after ${Date.now() - tracer.startTime}ms:`, error);
      throw error;
    }
  }
}

/**
 * Simple timing decorator for functions
 */
export function withTiming<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return PerformanceTracer.trace(name, async (tracer) => {
      tracer.mark('function-start');
      const result = await fn(...args);
      tracer.mark('function-end');
      return result;
    });
  };
}
