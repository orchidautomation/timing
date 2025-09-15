/**
 * Cloudflare Worker for Linear OpenCode Agent
 * Handles webhooks with edge performance and global distribution
 */

export interface Env {
  // KV Namespaces
  SESSIONS: KVNamespace;
  
  // Queues
  SESSION_QUEUE: Queue;
  
  // Secrets
  LINEAR_API_KEY: string;
  LINEAR_WEBHOOK_SECRET: string;
  DEEPSEEK_API_KEY: string;
  GROQ_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  TASKMASTER_API_KEY?: string;
  
  // Environment variables
  OPENCODE_MODEL: string;
  NODE_ENV: string;
}

interface WebhookPayload {
  action: string;
  type: string;
  data: any;
  organizationId: string;
  webhookId: string;
  webhookTimestamp: number;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        region: request.cf?.colo || 'unknown',
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Linear webhook endpoint
    if (url.pathname === '/webhooks/linear') {
      return handleLinearWebhook(request, env, ctx);
    }
    
    // Session status endpoint
    if (url.pathname.startsWith('/session/')) {
      const sessionId = url.pathname.split('/')[2];
      return getSessionStatus(sessionId, env);
    }
    
    return new Response('Not found', { status: 404 });
  },
  
  // Queue consumer for processing agent sessions
  async queue(
    batch: MessageBatch<WebhookPayload>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processAgentSession(message.body, env);
        message.ack();
      } catch (error) {
        console.error('Failed to process message:', error);
        message.retry();
      }
    }
  }
};

/**
 * Handle Linear webhook
 */
async function handleLinearWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Verify webhook signature
    const signature = request.headers.get('linear-signature');
    const body = await request.text();
    
    if (!verifySignature(body, signature, env.LINEAR_WEBHOOK_SECRET)) {
      return new Response('Invalid signature', { status: 401 });
    }
    
    const payload: WebhookPayload = JSON.parse(body);
    
    // Log webhook receipt
    console.log('Webhook received:', {
      type: payload.type,
      action: payload.action,
      organizationId: payload.organizationId
    });
    
    // Immediately acknowledge webhook (Linear requires <5s response)
    const response = new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Process asynchronously via queue
    if (payload.type === 'AgentSessionEvent') {
      ctx.waitUntil(
        env.SESSION_QUEUE.send(payload)
      );
    }
    
    return response;
    
  } catch (error) {
    console.error('Webhook handling error:', error);
    // Don't return error to avoid webhook retries
    return new Response(JSON.stringify({ 
      received: true, 
      error: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Process agent session from queue
 */
async function processAgentSession(
  payload: WebhookPayload,
  env: Env
): Promise<void> {
  const { action, data } = payload;
  const { agentSession } = data;
  
  console.log('Processing agent session:', {
    action,
    sessionId: agentSession.id
  });
  
  // Store session state in KV
  await env.SESSIONS.put(
    `session:${agentSession.id}`,
    JSON.stringify({
      ...agentSession,
      status: 'processing',
      timestamp: Date.now()
    }),
    { expirationTtl: 3600 } // 1 hour TTL
  );
  
  if (action === 'created') {
    // Must emit initial activity within 10 seconds
    await emitInitialThought(agentSession.id, env);
    
    // Process the full request
    await processRequest(agentSession, env);
    
  } else if (action === 'prompted') {
    // Handle user follow-up
    await handlePrompt(agentSession, data.agentActivity, env);
  }
  
  // Update session state
  await env.SESSIONS.put(
    `session:${agentSession.id}`,
    JSON.stringify({
      ...agentSession,
      status: 'completed',
      completedAt: Date.now()
    }),
    { expirationTtl: 3600 }
  );
}

/**
 * Emit initial thought activity
 */
async function emitInitialThought(
  sessionId: string,
  env: Env
): Promise<void> {
  const mutation = `
    mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `;
  
  await callLinearAPI(mutation, {
    input: {
      agentSessionId: sessionId,
      content: {
        type: 'thought',
        body: '🤔 Analyzing your request...'
      },
      ephemeral: true
    }
  }, env);
}

/**
 * Process the main request
 */
async function processRequest(
  session: any,
  env: Env
): Promise<void> {
  try {
    // Extract context
    const context = {
      issue: session.issue,
      comment: session.comment,
      previousComments: session.previousComments,
      guidance: session.guidance
    };
    
    // Call OpenCode model
    const response = await callOpenCode(context, env);
    
    // Emit response activity
    await emitResponse(session.id, response, env);
    
  } catch (error) {
    console.error('Request processing failed:', error);
    await emitError(session.id, error.message, env);
  }
}

/**
 * Call OpenCode model (DeepSeek/Groq)
 */
async function callOpenCode(
  context: any,
  env: Env
): Promise<any> {
  const model = env.OPENCODE_MODEL || 'deepseek/deepseek-r1-distill-llama-3.2-8b';
  
  // Build prompt
  const prompt = buildPrompt(context);
  
  // Call appropriate model API
  if (model.includes('deepseek')) {
    return callDeepSeek(prompt, env);
  } else if (model.includes('groq')) {
    return callGroq(prompt, env);
  }
  
  throw new Error(`Unsupported model: ${model}`);
}

/**
 * Call DeepSeek API
 */
async function callDeepSeek(
  prompt: string,
  env: Env
): Promise<any> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-r1-distill-llama-70b',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful Linear agent assistant. Respond concisely and professionally.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
  };
}

/**
 * Call Linear API
 */
async function callLinearAPI(
  query: string,
  variables: any,
  env: Env
): Promise<any> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': env.LINEAR_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  
  return response.json();
}

/**
 * Emit response activity
 */
async function emitResponse(
  sessionId: string,
  response: any,
  env: Env
): Promise<void> {
  const mutation = `
    mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `;
  
  await callLinearAPI(mutation, {
    input: {
      agentSessionId: sessionId,
      content: {
        type: 'response',
        body: response.content
      }
    }
  }, env);
}

/**
 * Emit error activity
 */
async function emitError(
  sessionId: string,
  message: string,
  env: Env
): Promise<void> {
  const mutation = `
    mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `;
  
  await callLinearAPI(mutation, {
    input: {
      agentSessionId: sessionId,
      content: {
        type: 'error',
        body: `An error occurred: ${message}`,
        retry: true
      }
    }
  }, env);
}

/**
 * Get session status
 */
async function getSessionStatus(
  sessionId: string,
  env: Env
): Promise<Response> {
  const session = await env.SESSIONS.get(`session:${sessionId}`);
  
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }
  
  return new Response(session, {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Verify Linear webhook signature
 */
function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  
  // Implementation depends on Linear's signature method
  // This is a placeholder - implement actual verification
  return true;
}

/**
 * Build prompt from context
 */
function buildPrompt(context: any): string {
  let prompt = '';
  
  if (context.issue) {
    prompt += `Issue: ${context.issue.title}\n`;
    if (context.issue.description) {
      prompt += `Description: ${context.issue.description}\n`;
    }
  }
  
  if (context.comment) {
    prompt += `\nUser comment: ${context.comment.body}\n`;
  }
  
  if (context.previousComments?.length > 0) {
    prompt += '\nPrevious comments:\n';
    context.previousComments.forEach((c: any) => {
      prompt += `- ${c.body}\n`;
    });
  }
  
  if (context.guidance) {
    prompt += `\nGuidance: ${context.guidance}\n`;
  }
  
  prompt += '\nPlease provide a helpful response to address this request.';
  
  return prompt;
}

/**
 * Handle user prompt/follow-up
 */
async function handlePrompt(
  session: any,
  activity: any,
  env: Env
): Promise<void> {
  // Check for stop signal
  if (activity.signal === 'stop') {
    await emitResponse(
      session.id,
      { content: '⏹️ Stopped as requested.' },
      env
    );
    return;
  }
  
  // Process the follow-up
  const context = {
    ...session,
    userPrompt: activity.body
  };
  
  await processRequest(context, env);
}

// Call Groq API (if using Groq instead of DeepSeek)
async function callGroq(prompt: string, env: Env): Promise<any> {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-instruct',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful Linear agent assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
  };
}