import crypto from 'crypto';
import { Request } from 'express';

/**
 * Verify Linear webhook signature
 */
export function verifyLinearWebhook(req: Request): boolean {
  const signature = req.headers['linear-signature'] as string;
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  
  if (!signature || !secret) {
    return false;
  }
  
  // Linear uses HMAC-SHA256 for webhook signatures
  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  // Remove any potential script tags or dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private windowMs: number = 60000, // 1 minute
    private maxRequests: number = 100
  ) {}
  
  /**
   * Check if request should be allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }
    
    return true;
  }
  
  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        timestamp => now - timestamp < this.windowMs
      );
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): void {
  const required = [
    'LINEAR_API_KEY',
    'LINEAR_WEBHOOK_SECRET',
    'DEEPSEEK_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Mask sensitive data in logs
 */
export function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const masked = { ...data };
  const sensitiveKeys = [
    'apiKey',
    'token',
    'secret',
    'password',
    'access_token',
    'refresh_token'
  ];
  
  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    )) {
      masked[key] = '[REDACTED]';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  
  return masked;
}