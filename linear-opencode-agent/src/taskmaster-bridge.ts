import { LinearClient } from '@linear/sdk';
import { TaskMasterClient } from './taskmaster-client';
import { logger } from './utils/logger';

export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  teamId: string;
  identifier?: string;
  url?: string;
}

export interface TaskMasterTask {
  id: string;
  title: string;
  description: string;
  details?: string;
  status: string;
  dependencies?: string[];
  subtasks?: TaskMasterTask[];
}

export class TaskMasterLinearBridge {
  private taskToIssueMap: Map<string, string> = new Map();
  private issueToTaskMap: Map<string, string> = new Map();

  constructor(
    private taskmaster: TaskMasterClient,
    private linear: LinearClient
  ) {}

  /**
   * Handle a complex task by creating TaskMaster project and Linear sub-issues
   */
  async handleComplexTask(sessionId: string, issue: LinearIssue): Promise<{
    project: any;
    tasks: TaskMasterTask[];
  }> {
    logger.info('Handling complex task', { sessionId, issueId: issue.id });
    
    try {
      // Generate PRD from Linear issue
      const prd = await this.generatePRD(issue);
      
      // Initialize TaskMaster project
      const project = await this.taskmaster.initializeProject({
        name: issue.title,
        description: prd,
        models: {
          main: 'deepseek/deepseek-r1-distill-llama-3.2-8b',
          research: 'perplexity/sonar-pro',
          fallback: 'groq/llama-3.3-70b-instruct'
        }
      });
      
      // Parse PRD into tasks
      const tasks = await this.taskmaster.parsePRD(project.id, prd);
      
      // Create Linear sub-issues for each task
      await this.createLinearSubIssues(issue, tasks);
      
      // Store project mapping
      await this.storeProjectMapping(issue.id, project.id);
      
      return { project, tasks };
      
    } catch (error) {
      logger.error('Failed to handle complex task', { error, sessionId });
      throw error;
    }
  }

  /**
   * Execute the next available task
   */
  async executeNextTask(sessionId: string): Promise<{
    done: boolean;
    task?: TaskMasterTask;
    result?: any;
  }> {
    try {
      // Get next task from TaskMaster
      const nextTask = await this.taskmaster.getNextTask();
      
      if (!nextTask) {
        logger.info('No more tasks to execute', { sessionId });
        return { done: true };
      }
      
      logger.info('Executing task', { 
        sessionId, 
        taskId: nextTask.id,
        title: nextTask.title 
      });
      
      // Update Linear sub-issue status
      const linearIssueId = this.taskToIssueMap.get(nextTask.id);
      if (linearIssueId) {
        await this.updateLinearIssueStatus(linearIssueId, 'in_progress');
      }
      
      // Execute the task
      const result = await this.taskmaster.executeTask(nextTask.id);
      
      // Update status based on result
      if (linearIssueId) {
        const newStatus = result.success ? 'done' : 'cancelled';
        await this.updateLinearIssueStatus(linearIssueId, newStatus);
        
        // Add execution details as comment
        await this.addLinearComment(linearIssueId, this.formatExecutionResult(result));
      }
      
      // Update TaskMaster status
      await this.taskmaster.updateTaskStatus(nextTask.id, result.success ? 'completed' : 'failed');
      
      return {
        done: false,
        task: nextTask,
        result
      };
      
    } catch (error) {
      logger.error('Task execution failed', { error, sessionId });
      throw error;
    }
  }

  /**
   * Generate PRD from Linear issue
   */
  private async generatePRD(issue: LinearIssue): Promise<string> {
    const prdTemplate = `# Product Requirements Document

## Project: ${issue.title}

### Overview
${issue.description || 'No description provided'}

### Objectives
- Implement the requested functionality
- Ensure code quality and testing
- Document the implementation

### Technical Requirements
- Follow existing code patterns
- Write appropriate tests
- Handle edge cases
- Provide clear documentation

### Success Criteria
- All functionality implemented as requested
- Tests passing
- Code review approved
- Documentation complete

### Implementation Approach
Break down the implementation into logical tasks that can be completed incrementally.`;
    
    // Could enhance this with AI-generated PRD based on issue context
    return prdTemplate;
  }

  /**
   * Create Linear sub-issues for TaskMaster tasks
   */
  private async createLinearSubIssues(
    parentIssue: LinearIssue,
    tasks: TaskMasterTask[]
  ): Promise<void> {
    for (const task of tasks) {
      try {
        // Create sub-issue in Linear
        const subIssue = await this.linear.createIssue({
          title: `[Task ${task.id}] ${task.title}`,
          description: this.formatTaskDescription(task),
          parentId: parentIssue.id,
          teamId: parentIssue.teamId,
          labels: [{ name: 'opencode-task' }, { name: 'automated' }]
        });
        
        // Store mapping
        this.taskToIssueMap.set(task.id, subIssue.id);
        this.issueToTaskMap.set(subIssue.id, task.id);
        
        logger.info('Created Linear sub-issue', {
          taskId: task.id,
          issueId: subIssue.id,
          title: task.title
        });
        
        // Handle subtasks recursively if present
        if (task.subtasks && task.subtasks.length > 0) {
          await this.createLinearSubIssues(
            { ...parentIssue, id: subIssue.id },
            task.subtasks
          );
        }
        
      } catch (error) {
        logger.error('Failed to create Linear sub-issue', {
          error,
          taskId: task.id
        });
      }
    }
  }

  /**
   * Format task description for Linear
   */
  private formatTaskDescription(task: TaskMasterTask): string {
    let description = `## Task Details\n\n${task.description}\n`;
    
    if (task.details) {
      description += `\n### Implementation Details\n${task.details}\n`;
    }
    
    if (task.dependencies && task.dependencies.length > 0) {
      description += `\n### Dependencies\n`;
      task.dependencies.forEach(dep => {
        description += `- Task ${dep}\n`;
      });
    }
    
    if (task.subtasks && task.subtasks.length > 0) {
      description += `\n### Subtasks\n`;
      task.subtasks.forEach(subtask => {
        description += `- [ ] ${subtask.title}\n`;
      });
    }
    
    description += `\n---\n*Generated by OpenCode Agent with TaskMaster*`;
    
    return description;
  }

  /**
   * Update Linear issue status
   */
  private async updateLinearIssueStatus(issueId: string, status: string): Promise<void> {
    try {
      // Map status to Linear state
      const stateMap: Record<string, string> = {
        'pending': 'backlog',
        'in_progress': 'in_progress',
        'in-progress': 'in_progress',
        'review': 'in_review',
        'done': 'done',
        'completed': 'done',
        'cancelled': 'cancelled',
        'failed': 'cancelled'
      };
      
      const linearState = stateMap[status] || 'backlog';
      
      // Get the appropriate workflow state
      const states = await this.linear.workflowStates({
        filter: { name: { eq: linearState } }
      });
      
      if (states.nodes.length > 0) {
        await this.linear.updateIssue(issueId, {
          stateId: states.nodes[0].id
        });
        
        logger.info('Updated Linear issue status', {
          issueId,
          status: linearState
        });
      }
      
    } catch (error) {
      logger.error('Failed to update Linear issue status', {
        error,
        issueId,
        status
      });
    }
  }

  /**
   * Add comment to Linear issue
   */
  private async addLinearComment(issueId: string, comment: string): Promise<void> {
    try {
      await this.linear.createComment({
        issueId,
        body: comment
      });
      
      logger.info('Added comment to Linear issue', { issueId });
      
    } catch (error) {
      logger.error('Failed to add Linear comment', {
        error,
        issueId
      });
    }
  }

  /**
   * Format execution result for Linear comment
   */
  private formatExecutionResult(result: any): string {
    const status = result.success ? '✅ Success' : '❌ Failed';
    
    let comment = `## Task Execution Result\n\n**Status**: ${status}\n`;
    
    if (result.details) {
      comment += `\n### Details\n${result.details}\n`;
    }
    
    if (result.error) {
      comment += `\n### Error\n\`\`\`\n${result.error}\n\`\`\`\n`;
    }
    
    if (result.changes) {
      comment += `\n### Changes Made\n`;
      result.changes.forEach((change: string) => {
        comment += `- ${change}\n`;
      });
    }
    
    comment += `\n*Executed by OpenCode Agent at ${new Date().toISOString()}*`;
    
    return comment;
  }

  /**
   * Store project mapping for future reference
   */
  private async storeProjectMapping(linearIssueId: string, taskmasterProjectId: string): Promise<void> {
    // In production, store this in a database or KV store
    logger.info('Stored project mapping', {
      linearIssueId,
      taskmasterProjectId
    });
  }

  /**
   * Sync task status from TaskMaster to Linear
   */
  async syncTaskStatus(taskId: string): Promise<void> {
    try {
      const linearIssueId = this.taskToIssueMap.get(taskId);
      if (!linearIssueId) {
        logger.warn('No Linear issue mapping found for task', { taskId });
        return;
      }
      
      const taskStatus = await this.taskmaster.getTaskStatus(taskId);
      await this.updateLinearIssueStatus(linearIssueId, taskStatus);
      
      logger.info('Synced task status', {
        taskId,
        linearIssueId,
        status: taskStatus
      });
      
    } catch (error) {
      logger.error('Failed to sync task status', {
        error,
        taskId
      });
    }
  }

  /**
   * Get task progress summary
   */
  async getProgressSummary(projectId: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    percentage: number;
  }> {
    try {
      const tasks = await this.taskmaster.getAllTasks(projectId);
      
      const summary = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        percentage: 0
      };
      
      summary.percentage = Math.round((summary.completed / summary.total) * 100);
      
      return summary;
      
    } catch (error) {
      logger.error('Failed to get progress summary', { error, projectId });
      throw error;
    }
  }
}