import pino from 'pino';

// Create logger instance with appropriate configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'apiKey',
      'access_token',
      'refresh_token',
      'LINEAR_API_KEY',
      'DEEPSEEK_API_KEY',
      'GROQ_API_KEY',
      'OPENAI_API_KEY'
    ],
    censor: '[REDACTED]'
  }
});

// Add request ID to child logger for tracing
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}