import { LinearClient } from '@linear/sdk';
import { OpenCodeClient } from './opencode-client';
import { TaskMasterClient } from './taskmaster-client';
import { ActivityEmitter } from './activities';
import { TaskMasterLinearBridge } from './taskmaster-bridge';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

export interface AgentSession {
  id: string;
  issue?: {
    id: string;
    title: string;
    description?: string;
    teamId: string;
    labels?: Array<{ name: string }>;
    priority?: number;
  };
  comment?: {
    id: string;
    body: string;
  };
  previousComments?: Array<{
    body: string;
    createdAt: string;
  }>;
  guidance?: string;
}

export class AgentSessionManager {
  private activityEmitter: ActivityEmitter;
  private taskmasterBridge: TaskMasterLinearBridge;
  private activeSessions: Map<string, any> = new Map();
  private permissionsCache: Map<string, any> = new Map();

  constructor(
    private linear: LinearClient,
    private opencode: OpenCodeClient,
    private taskmaster: TaskMasterClient
  ) {
    this.activityEmitter = new ActivityEmitter(linear);
    this.taskmasterBridge = new TaskMasterLinearBridge(taskmaster, linear);
  }

  /**
   * Handle a new agent session
   */
  async handleNewSession(session: AgentSession): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Store session
      this.activeSessions.set(session.id, {
        ...session,
        startTime,
        status: 'active'
      });

      // Extract context
      const context = this.extractContext(session);
      
      // Determine request type
      const requestType = await this.classifyRequest(context);
      logger.info('Request classified', { sessionId: session.id, type: requestType });
      
      // Route to appropriate handler
      switch (requestType) {
        case 'task_creation':
          await this.handleTaskCreation(session, context);
          break;
        
        case 'complex_project':
          await this.handleComplexProject(session, context);
          break;
        
        case 'code_review':
          await this.handleCodeReview(session, context);
          break;
        
        case 'bug_fix':
          await this.handleBugFix(session, context);
          break;
        
        case 'question':
          await this.handleQuestion(session, context);
          break;
        
        case 'status_update':
          await this.handleStatusUpdate(session, context);
          break;
        
        default:
          await this.handleGenericRequest(session, context);
      }
      
      // Track metrics
      const duration = Date.now() - startTime;
      metrics.sessionDuration.observe({ type: requestType }, duration);
      
    } catch (error) {
      logger.error('Session handling failed', { 
        error, 
        sessionId: session.id 
      });
      
      await this.activityEmitter.emitError(
        session.id,
        `Failed to process request: ${error.message}`,
        true
      );
      
      throw error;
    } finally {
      // Clean up session
      this.activeSessions.delete(session.id);
    }
  }

  /**
   * Handle user prompt/follow-up
   */
  async handlePrompt(session: AgentSession, activity: any): Promise<void> {
    try {
      // Check for stop signal
      if (activity.signal === 'stop') {
        await this.handleStopSignal(session.id);
        return;
      }
      
      // Get session state
      const sessionState = this.activeSessions.get(session.id);
      
      if (sessionState?.waitingForInput) {
        // Handle expected input
        await this.handleExpectedInput(session, activity, sessionState);
      } else {
        // Handle as new context
        const context = {
          ...this.extractContext(session),
          userPrompt: activity.body
        };
        
        await this.processWithOpenCode(session.id, context);
      }
      
    } catch (error) {
      logger.error('Prompt handling failed', { 
        error, 
        sessionId: session.id 
      });
      
      await this.activityEmitter.emitError(
        session.id,
        `Failed to process your input: ${error.message}`,
        true
      );
    }
  }

  /**
   * Create a proactive session
   */
  async createProactiveSession(notification: any): Promise<void> {
    try {
      const { issue } = notification;
      
      // Create session on the issue
      const mutation = `
        mutation AgentSessionCreateOnIssue($issueId: String!, $reason: String) {
          agentSessionCreateOnIssue(issueId: $issueId, reason: $reason) {
            success
            agentSession {
              id
            }
          }
        }
      `;
      
      const response = await this.linear.request(mutation, {
        issueId: issue.id,
        reason: this.getProactiveReason(notification)
      });
      
      if (response.agentSessionCreateOnIssue?.success) {
        const session = response.agentSessionCreateOnIssue.agentSession;
        
        // Process the session
        await this.handleNewSession({
          id: session.id,
          issue
        });
      }
      
    } catch (error) {
      logger.error('Failed to create proactive session', { error });
    }
  }

  /**
   * Handle task creation request
   */
  private async handleTaskCreation(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitProcess(session.id, [
      { type: 'thought', message: '📝 Preparing to create a new task...' },
      { type: 'action', tool: 'analyze_request', args: { type: 'task' } }
    ]);
    
    // Parse task details
    const taskDetails = await this.opencode.extractTaskDetails(context);
    
    // Create Linear issue
    const issue = await this.linear.createIssue({
      title: taskDetails.title,
      description: taskDetails.description,
      teamId: session.issue?.teamId || context.teamId,
      labels: taskDetails.labels,
      priority: taskDetails.priority
    });
    
    // Create success response
    await this.activityEmitter.emitResponse(
      session.id,
      `✅ Created task: **${taskDetails.title}**\n\nIssue: ${issue.identifier}\n\n${taskDetails.description}`,
      [
        { label: 'View Issue', url: issue.url },
        { label: 'Add Details', command: '/add-details' }
      ]
    );
  }

  /**
   * Handle complex project with TaskMaster
   */
  private async handleComplexProject(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitProcess(session.id, [
      { type: 'thought', message: '🚀 This looks like a complex project. Analyzing requirements...' },
      { type: 'action', tool: 'taskmaster', args: { action: 'initialize' } }
    ]);
    
    try {
      // Use TaskMaster bridge to handle the complex task
      const result = await this.taskmasterBridge.handleComplexTask(
        session.id,
        session.issue!
      );
      
      // Emit progress
      const tasks = result.tasks;
      await this.activityEmitter.emitTaskList(
        session.id,
        tasks.map(t => ({
          title: t.title,
          completed: false,
          inProgress: false
        }))
      );
      
      // Start execution
      await this.activityEmitter.emitResponse(
        session.id,
        `📋 Created ${tasks.length} tasks for your project.\n\nI'll start working on them now. You can track progress in the sub-issues.`,
        [
          { label: 'View Tasks', url: `/issues?parent=${session.issue?.id}` },
          { label: 'Start Execution', command: '/execute' }
        ]
      );
      
      // Execute tasks in background
      this.executeTasksInBackground(session.id, result.project.id);
      
    } catch (error) {
      logger.error('Complex project handling failed', { error });
      throw error;
    }
  }

  /**
   * Handle code review request
   */
  private async handleCodeReview(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitThought(
      session.id,
      '🔍 Analyzing code for review...'
    );
    
    // Extract code context (PR, files, etc.)
    const codeContext = await this.extractCodeContext(context);
    
    // Perform review with OpenCode
    const review = await this.opencode.performCodeReview(codeContext);
    
    // Format and emit review
    const formattedReview = this.formatCodeReview(review);
    
    await this.activityEmitter.emitResponse(
      session.id,
      formattedReview,
      [
        { label: 'Apply Suggestions', command: '/apply-suggestions' },
        { label: 'Request Changes', command: '/request-changes' }
      ]
    );
  }

  /**
   * Handle bug fix request
   */
  private async handleBugFix(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitProcess(session.id, [
      { type: 'thought', message: '🐛 Investigating the bug...' },
      { type: 'action', tool: 'analyze_code', args: { type: 'bug' } }
    ]);
    
    // Analyze bug
    const bugAnalysis = await this.opencode.analyzeBug(context);
    
    if (bugAnalysis.needsMoreInfo) {
      // Request more information
      await this.activityEmitter.emitElicitation(
        session.id,
        bugAnalysis.question,
        bugAnalysis.options
      );
      
      // Mark session as waiting for input
      const sessionState = this.activeSessions.get(session.id);
      if (sessionState) {
        sessionState.waitingForInput = true;
        sessionState.inputContext = { type: 'bug_info', analysis: bugAnalysis };
      }
      
    } else {
      // Provide fix
      await this.provideBugFix(session.id, bugAnalysis);
    }
  }

  /**
   * Handle question/query
   */
  private async handleQuestion(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitThought(
      session.id,
      '💭 Processing your question...',
      true
    );
    
    // Get answer from OpenCode
    const answer = await this.opencode.answerQuestion(context);
    
    // Emit response
    await this.activityEmitter.emitResponse(
      session.id,
      answer.content,
      answer.suggestedActions
    );
  }

  /**
   * Handle status update request
   */
  private async handleStatusUpdate(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitThought(
      session.id,
      '📊 Gathering status information...'
    );
    
    // Get status from various sources
    const status = await this.gatherStatus(context);
    
    // Format status update
    const statusUpdate = this.formatStatusUpdate(status);
    
    await this.activityEmitter.emitResponse(
      session.id,
      statusUpdate
    );
  }

  /**
   * Handle generic request
   */
  private async handleGenericRequest(session: AgentSession, context: any): Promise<void> {
    await this.activityEmitter.emitThought(
      session.id,
      '🤖 Processing your request...'
    );
    
    // Process with OpenCode
    const response = await this.processWithOpenCode(session.id, context);
    
    await this.activityEmitter.emitResponse(
      session.id,
      response.content,
      response.actions
    );
  }

  /**
   * Process request with OpenCode
   */
  private async processWithOpenCode(sessionId: string, context: any): Promise<any> {
    try {
      // Emit processing activities
      const activities = await this.opencode.getProcessingActivities(context);
      
      for (const activity of activities) {
        if (activity.type === 'thought') {
          await this.activityEmitter.emitThought(
            sessionId,
            activity.message,
            activity.ephemeral
          );
        } else if (activity.type === 'action') {
          await this.activityEmitter.emitAction(
            sessionId,
            activity.tool,
            activity.args,
            activity.ephemeral
          );
        }
        
        if (activity.delay) {
          await this.delay(activity.delay);
        }
      }
      
      // Get final response
      return await this.opencode.processRequest(context);
      
    } catch (error) {
      logger.error('OpenCode processing failed', { error });
      throw error;
    }
  }

  /**
   * Extract context from session
   */
  private extractContext(session: AgentSession): any {
    return {
      issueId: session.issue?.id,
      issueTitle: session.issue?.title,
      issueDescription: session.issue?.description,
      comment: session.comment?.body,
      previousComments: session.previousComments,
      guidance: session.guidance,
      teamId: session.issue?.teamId,
      labels: session.issue?.labels,
      priority: session.issue?.priority
    };
  }

  /**
   * Classify the type of request
   */
  private async classifyRequest(context: any): Promise<string> {
    const text = `${context.issueTitle || ''} ${context.issueDescription || ''} ${context.comment || ''}`.toLowerCase();
    
    // Pattern matching for request types
    if (text.includes('create task') || text.includes('new task')) {
      return 'task_creation';
    }
    
    if (text.includes('implement') || text.includes('build') || text.includes('develop')) {
      return 'complex_project';
    }
    
    if (text.includes('review') || text.includes('pr') || text.includes('pull request')) {
      return 'code_review';
    }
    
    if (text.includes('bug') || text.includes('fix') || text.includes('error')) {
      return 'bug_fix';
    }
    
    if (text.includes('?') || text.includes('how') || text.includes('what') || text.includes('why')) {
      return 'question';
    }
    
    if (text.includes('status') || text.includes('progress') || text.includes('update')) {
      return 'status_update';
    }
    
    // Use OpenCode for classification if patterns don't match
    return await this.opencode.classifyRequest(context);
  }

  /**
   * Handle stop signal
   */
  private async handleStopSignal(sessionId: string): Promise<void> {
    logger.info('Stop signal received', { sessionId });
    
    // Clean up any ongoing operations
    const session = this.activeSessions.get(sessionId);
    if (session?.backgroundTask) {
      session.backgroundTask.cancel();
    }
    
    await this.activityEmitter.emitResponse(
      sessionId,
      '⏹️ Stopped as requested. Let me know if you need anything else!'
    );
    
    this.activeSessions.delete(sessionId);
  }

  /**
   * Execute tasks in background
   */
  private async executeTasksInBackground(sessionId: string, projectId: string): Promise<void> {
    try {
      while (true) {
        const result = await this.taskmasterBridge.executeNextTask(sessionId);
        
        if (result.done) {
          await this.activityEmitter.emitResponse(
            sessionId,
            '✅ All tasks completed successfully!'
          );
          break;
        }
        
        // Small delay between tasks
        await this.delay(1000);
      }
    } catch (error) {
      logger.error('Background task execution failed', { error, sessionId });
    }
  }

  /**
   * Update permissions cache
   */
  async updatePermissions(workspaceId: string, permissions: any): Promise<void> {
    this.permissionsCache.set(workspaceId, {
      permissions,
      updatedAt: new Date()
    });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Cancel any active sessions
    for (const [sessionId, session] of this.activeSessions) {
      if (session.backgroundTask) {
        session.backgroundTask.cancel();
      }
    }
    
    this.activeSessions.clear();
    this.permissionsCache.clear();
  }

  // Helper methods...
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getProactiveReason(notification: any): string {
    if (notification.type === 'assignment') {
      return 'You were assigned to this issue';
    }
    if (notification.issue?.priority >= 1) {
      return 'High priority issue detected';
    }
    return 'Automated assistance triggered';
  }

  private async extractCodeContext(context: any): Promise<any> {
    // Implementation for extracting code context
    return {};
  }

  private formatCodeReview(review: any): string {
    // Implementation for formatting code review
    return '';
  }

  private async provideBugFix(sessionId: string, analysis: any): Promise<void> {
    // Implementation for providing bug fix
  }

  private async handleExpectedInput(session: AgentSession, activity: any, state: any): Promise<void> {
    // Implementation for handling expected input
  }

  private async gatherStatus(context: any): Promise<any> {
    // Implementation for gathering status
    return {};
  }

  private formatStatusUpdate(status: any): string {
    // Implementation for formatting status update
    return '';
  }
}