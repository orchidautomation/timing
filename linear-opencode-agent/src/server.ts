import express from 'express';
import { LinearClient } from '@linear/sdk';
import { OpenCodeClient } from './opencode-client';
import { TaskMasterClient } from './taskmaster-client';
import { ActivityEmitter } from './activities';
import { AgentSessionManager } from './session-manager';
import { verifyLinearWebhook } from './utils/security';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

const app = express();
app.use(express.json());

// Initialize clients
const linear = new LinearClient({ 
  apiKey: process.env.LINEAR_API_KEY! 
});

const opencode = new OpenCodeClient({
  model: process.env.OPENCODE_MODEL || 'deepseek/deepseek-r1-distill-llama-3.2-8b',
  apiKey: process.env.DEEPSEEK_API_KEY!
});

const taskmaster = new TaskMasterClient({
  apiKey: process.env.TASKMASTER_API_KEY
});

const activityEmitter = new ActivityEmitter(linear);
const sessionManager = new AgentSessionManager(linear, opencode, taskmaster);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    version: process.env.npm_package_version,
    uptime: process.uptime()
  });
});

// Main webhook handler for Linear events
app.post('/webhooks/linear', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verify webhook signature
    if (!verifyLinearWebhook(req)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { action, type, data } = req.body;
    
    // Acknowledge webhook immediately (within 5 seconds)
    res.status(200).json({ received: true });
    
    // Track metrics
    metrics.webhooksReceived.inc({ type, action });
    
    // Process different event types
    if (type === 'AgentSessionEvent') {
      await handleAgentSessionEvent(action, data);
    } else if (type === 'PermissionChange') {
      await handlePermissionChange(data);
    } else if (type === 'InboxNotification') {
      await handleInboxNotification(data);
    }
    
    // Track processing time
    const duration = Date.now() - startTime;
    metrics.webhookProcessingTime.observe({ type }, duration);
    
  } catch (error) {
    logger.error('Webhook processing error', { error, body: req.body });
    metrics.webhookErrors.inc({ type: req.body.type });
    
    // Don't return error to Linear to avoid webhook retries
    if (!res.headersSent) {
      res.status(200).json({ received: true, error: true });
    }
  }
});

// Handle agent session events
async function handleAgentSessionEvent(action: string, data: any) {
  const { agentSession, agentActivity } = data;
  
  logger.info('Agent session event', {
    action,
    sessionId: agentSession.id,
    issueId: agentSession.issue?.id
  });
  
  try {
    if (action === 'created') {
      // New session created - must respond within 10 seconds
      const responseTimer = setTimeout(async () => {
        // Emergency response if processing takes too long
        await activityEmitter.emitThought(
          agentSession.id,
          "Still processing your request, this is taking longer than expected..."
        );
      }, 9000);
      
      // Immediately emit initial thought
      await activityEmitter.emitThought(
        agentSession.id,
        "🤔 Analyzing your request...",
        true // ephemeral
      );
      
      // Process the session
      await sessionManager.handleNewSession(agentSession);
      
      clearTimeout(responseTimer);
      
    } else if (action === 'prompted') {
      // User provided additional input
      await sessionManager.handlePrompt(agentSession, agentActivity);
    }
    
    metrics.sessionsProcessed.inc({ action });
    
  } catch (error) {
    logger.error('Session handling error', { 
      error, 
      sessionId: agentSession.id 
    });
    
    // Emit error to user
    await activityEmitter.emitError(
      agentSession.id,
      `An error occurred: ${error.message}`,
      true // allow retry
    );
    
    metrics.sessionErrors.inc({ action });
  }
}

// Handle permission changes
async function handlePermissionChange(data: any) {
  const { workspace, teams, permissions } = data;
  
  logger.info('Permission change', {
    workspace: workspace.id,
    teams: teams.map((t: any) => t.id),
    permissions
  });
  
  // Update internal permission cache
  await sessionManager.updatePermissions(workspace.id, permissions);
}

// Handle inbox notifications
async function handleInboxNotification(data: any) {
  const { notification } = data;
  
  // Only process if it's a direct mention or assignment
  if (notification.type === 'mention' || notification.type === 'assignment') {
    logger.info('Inbox notification', {
      type: notification.type,
      issueId: notification.issue?.id
    });
    
    // Check if we should create a proactive session
    if (shouldCreateProactiveSession(notification)) {
      await sessionManager.createProactiveSession(notification);
    }
  }
}

// Determine if we should proactively create a session
function shouldCreateProactiveSession(notification: any): boolean {
  // Create session for high-priority issues or specific labels
  const issue = notification.issue;
  
  if (!issue) return false;
  
  // Check for triggers
  const triggers = [
    issue.priority >= 1, // Urgent or High priority
    issue.labels?.some((l: any) => l.name === 'needs-ai'),
    issue.labels?.some((l: any) => l.name === 'automation'),
    notification.type === 'assignment' // Direct delegation
  ];
  
  return triggers.some(t => t);
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Linear OpenCode Agent running on port ${PORT}`);
  
  // Log configuration
  logger.info('Configuration', {
    model: process.env.OPENCODE_MODEL || 'deepseek/deepseek-r1-distill-llama-3.2-8b',
    hasLinearKey: !!process.env.LINEAR_API_KEY,
    hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
    hasTaskMasterKey: !!process.env.TASKMASTER_API_KEY
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await sessionManager.cleanup();
  process.exit(0);
});

export default app;