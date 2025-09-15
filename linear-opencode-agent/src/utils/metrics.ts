import { Counter, Histogram, Registry } from 'prom-client';

// Create a registry for metrics
export const register = new Registry();

// Define metrics
export const metrics = {
  // Webhook metrics
  webhooksReceived: new Counter({
    name: 'linear_webhooks_received_total',
    help: 'Total number of webhooks received from Linear',
    labelNames: ['type', 'action'],
    registers: [register]
  }),
  
  webhookProcessingTime: new Histogram({
    name: 'linear_webhook_processing_duration_seconds',
    help: 'Time taken to process Linear webhooks',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
  }),
  
  webhookErrors: new Counter({
    name: 'linear_webhook_errors_total',
    help: 'Total number of webhook processing errors',
    labelNames: ['type'],
    registers: [register]
  }),
  
  // Session metrics
  sessionsProcessed: new Counter({
    name: 'linear_agent_sessions_total',
    help: 'Total number of agent sessions processed',
    labelNames: ['action'],
    registers: [register]
  }),
  
  sessionDuration: new Histogram({
    name: 'linear_agent_session_duration_seconds',
    help: 'Duration of agent session processing',
    labelNames: ['type'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [register]
  }),
  
  sessionErrors: new Counter({
    name: 'linear_agent_session_errors_total',
    help: 'Total number of agent session errors',
    labelNames: ['action'],
    registers: [register]
  }),
  
  // Activity metrics
  activitiesEmitted: new Counter({
    name: 'linear_agent_activities_total',
    help: 'Total number of agent activities emitted',
    labelNames: ['type'],
    registers: [register]
  }),
  
  // Model metrics
  modelCalls: new Counter({
    name: 'opencode_model_calls_total',
    help: 'Total number of calls to OpenCode models',
    labelNames: ['model', 'status'],
    registers: [register]
  }),
  
  modelTokensUsed: new Counter({
    name: 'opencode_model_tokens_total',
    help: 'Total number of tokens used by OpenCode models',
    labelNames: ['model', 'type'],
    registers: [register]
  }),
  
  modelLatency: new Histogram({
    name: 'opencode_model_latency_seconds',
    help: 'Latency of OpenCode model calls',
    labelNames: ['model'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30],
    registers: [register]
  }),
  
  // TaskMaster metrics
  tasksCreated: new Counter({
    name: 'taskmaster_tasks_created_total',
    help: 'Total number of TaskMaster tasks created',
    registers: [register]
  }),
  
  tasksCompleted: new Counter({
    name: 'taskmaster_tasks_completed_total',
    help: 'Total number of TaskMaster tasks completed',
    labelNames: ['status'],
    registers: [register]
  })
};

// Export function to get metrics in Prometheus format
export function getMetrics(): Promise<string> {
  return register.metrics();
}

// Helper to track async operation duration
export async function trackDuration<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  try {
    return await operation();
  } finally {
    end();
  }
}