import { LinearClient } from '@linear/sdk';
import { logger } from './utils/logger';

export interface AgentActivityContent {
  type: 'thought' | 'action' | 'elicitation' | 'response' | 'error';
  [key: string]: any;
}

export interface ThoughtActivity {
  type: 'thought';
  body: string;
}

export interface ActionActivity {
  type: 'action';
  tool: string;
  arguments: Record<string, any>;
}

export interface ElicitationActivity {
  type: 'elicitation';
  prompt: string;
  options?: string[];
}

export interface ResponseActivity {
  type: 'response';
  body: string;
  actions?: Array<{
    label: string;
    url?: string;
    command?: string;
  }>;
}

export interface ErrorActivity {
  type: 'error';
  body: string;
  retry?: boolean;
}

export class ActivityEmitter {
  constructor(private linear: LinearClient) {}

  /**
   * Emit a thought activity (processing indicator)
   */
  async emitThought(
    sessionId: string, 
    message: string, 
    ephemeral = false
  ): Promise<void> {
    try {
      const activity: ThoughtActivity = {
        type: 'thought',
        body: message
      };

      await this.createActivity(sessionId, activity, ephemeral);
      logger.debug('Thought emitted', { sessionId, message, ephemeral });
    } catch (error) {
      logger.error('Failed to emit thought', { error, sessionId });
      throw error;
    }
  }

  /**
   * Emit an action activity (tool call)
   */
  async emitAction(
    sessionId: string,
    tool: string,
    args: Record<string, any>,
    ephemeral = false
  ): Promise<void> {
    try {
      const activity: ActionActivity = {
        type: 'action',
        tool,
        arguments: args
      };

      await this.createActivity(sessionId, activity, ephemeral);
      logger.debug('Action emitted', { sessionId, tool, ephemeral });
    } catch (error) {
      logger.error('Failed to emit action', { error, sessionId, tool });
      throw error;
    }
  }

  /**
   * Request user input
   */
  async emitElicitation(
    sessionId: string,
    prompt: string,
    options?: string[]
  ): Promise<void> {
    try {
      const activity: ElicitationActivity = {
        type: 'elicitation',
        prompt,
        ...(options && { options })
      };

      await this.createActivity(sessionId, activity);
      logger.debug('Elicitation emitted', { sessionId, prompt, options });
    } catch (error) {
      logger.error('Failed to emit elicitation', { error, sessionId });
      throw error;
    }
  }

  /**
   * Emit final response
   */
  async emitResponse(
    sessionId: string,
    body: string,
    actions?: Array<{ label: string; url?: string; command?: string }>
  ): Promise<void> {
    try {
      const activity: ResponseActivity = {
        type: 'response',
        body: this.formatMarkdown(body),
        ...(actions && { actions })
      };

      await this.createActivity(sessionId, activity);
      logger.info('Response emitted', { sessionId, hasActions: !!actions });
    } catch (error) {
      logger.error('Failed to emit response', { error, sessionId });
      throw error;
    }
  }

  /**
   * Emit error activity
   */
  async emitError(
    sessionId: string,
    message: string,
    retry = false
  ): Promise<void> {
    try {
      const activity: ErrorActivity = {
        type: 'error',
        body: message,
        retry
      };

      await this.createActivity(sessionId, activity);
      logger.warn('Error emitted', { sessionId, message, retry });
    } catch (error) {
      logger.error('Failed to emit error', { error, sessionId });
      throw error;
    }
  }

  /**
   * Emit a series of activities for a multi-step process
   */
  async emitProcess(
    sessionId: string,
    steps: Array<{
      type: 'thought' | 'action';
      message?: string;
      tool?: string;
      args?: Record<string, any>;
      delay?: number;
    }>
  ): Promise<void> {
    for (const step of steps) {
      if (step.delay) {
        await this.delay(step.delay);
      }

      if (step.type === 'thought' && step.message) {
        await this.emitThought(sessionId, step.message, true);
      } else if (step.type === 'action' && step.tool) {
        await this.emitAction(sessionId, step.tool, step.args || {}, true);
      }
    }
  }

  /**
   * Create an activity in Linear
   */
  private async createActivity(
    sessionId: string,
    content: AgentActivityContent,
    ephemeral = false
  ): Promise<void> {
    const input = {
      agentSessionId: sessionId,
      content,
      ...(ephemeral && { ephemeral })
    };

    const mutation = `
      mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
        agentActivityCreate(input: $input) {
          success
          agentActivity {
            id
            createdAt
          }
        }
      }
    `;

    const response = await this.linear.request(mutation, { input });
    
    if (!response.agentActivityCreate?.success) {
      throw new Error('Failed to create agent activity');
    }
  }

  /**
   * Format markdown with Linear-specific features
   */
  private formatMarkdown(text: string): string {
    // Convert URLs to mentions where appropriate
    // Example: https://linear.app/team/issue/ISSUE-123 -> mention
    
    // Convert user profile URLs to mentions
    text = text.replace(
      /https:\/\/linear\.app\/[\w-]+\/profiles\/([\w-]+)/g,
      'https://linear.app/$1/profiles/$2'
    );
    
    // Convert issue URLs to mentions
    text = text.replace(
      /https:\/\/linear\.app\/[\w-]+\/issue\/([\w-]+)/g,
      'https://linear.app/$1/issue/$2'
    );
    
    // Add formatting for code blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
    });
    
    return text;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit progress update for long-running operations
   */
  async emitProgress(
    sessionId: string,
    current: number,
    total: number,
    message: string
  ): Promise<void> {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    
    await this.emitThought(
      sessionId,
      `${progressBar} ${percentage}% - ${message}`,
      true // ephemeral
    );
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.floor(percentage / 5);
    const empty = 20 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Emit a structured task list
   */
  async emitTaskList(
    sessionId: string,
    tasks: Array<{
      title: string;
      completed: boolean;
      inProgress?: boolean;
    }>
  ): Promise<void> {
    const taskList = tasks.map(task => {
      const status = task.completed ? '✅' : (task.inProgress ? '🔄' : '⬜');
      return `${status} ${task.title}`;
    }).join('\n');
    
    const summary = `Tasks: ${tasks.filter(t => t.completed).length}/${tasks.length} completed`;
    
    await this.emitThought(
      sessionId,
      `${summary}\n\n${taskList}`,
      true
    );
  }
}