import { logger } from './utils/logger';

export interface OpenCodeConfig {
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProcessingActivity {
  type: 'thought' | 'action';
  message?: string;
  tool?: string;
  args?: Record<string, any>;
  ephemeral?: boolean;
  delay?: number;
}

export interface AgentContext {
  issueId?: string;
  issueTitle?: string;
  issueDescription?: string;
  comment?: string;
  previousComments?: Array<{ body: string; createdAt: string }>;
  guidance?: string;
  teamId?: string;
  labels?: Array<{ name: string }>;
  priority?: number;
  userPrompt?: string;
}

export class OpenCodeClient {
  private config: OpenCodeConfig;
  private systemPrompt: string;

  constructor(config: OpenCodeConfig) {
    this.config = config;
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Build the system prompt for the OpenCode model
   */
  private buildSystemPrompt(): string {
    return `You are a helpful Linear agent assistant. You must respond with EXACTLY ONE activity type per response.

CRITICAL: You can only emit ONE of these per response - never combine them:

THINKING: Use this for observations, analysis, or planning next steps
ACTION: Use this to call tools or perform operations (format: ACTION: tool_name(parameters))
ELICITATION: Ask the user for more information (ends your turn)
RESPONSE: Final response when task is complete (ends your turn)
ERROR: Report errors or problems (ends your turn)

RESPONSE FORMAT RULES:
1. Start with exactly ONE activity type
2. NEVER combine multiple activity types in a single response
3. Each response must be complete and standalone
4. Your first iteration should usually be a THINKING statement to acknowledge the request

For Linear-specific operations:
- Create issues with clear titles and descriptions
- Update issues with relevant status changes
- Link related issues when appropriate
- Use labels to categorize work
- Set appropriate priority levels (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)

For complex tasks:
- Break them down into subtasks
- Use TaskMaster for project management
- Create GitHub issues when code work is needed
- Track progress systematically

Context handling:
- Understand follow-up questions from conversation history
- Maintain context across multiple interactions
- Reference previous activities when relevant`;
  }

  /**
   * Process a request with OpenCode
   */
  async processRequest(context: AgentContext): Promise<any> {
    const prompt = this.buildPrompt(context);
    
    try {
      const response = await this.callModel(prompt);
      return this.parseResponse(response);
    } catch (error) {
      logger.error('OpenCode processing failed', { error });
      throw error;
    }
  }

  /**
   * Get processing activities for a request
   */
  async getProcessingActivities(context: AgentContext): Promise<ProcessingActivity[]> {
    const activities: ProcessingActivity[] = [];
    
    // Initial thinking activity
    activities.push({
      type: 'thought',
      message: this.getInitialThought(context),
      ephemeral: true,
      delay: 0
    });
    
    // Add relevant tool activities based on context
    if (this.isComplexTask(context)) {
      activities.push({
        type: 'action',
        tool: 'analyze_complexity',
        args: { context },
        ephemeral: true,
        delay: 500
      });
    }
    
    return activities;
  }

  /**
   * Build prompt from context
   */
  private buildPrompt(context: AgentContext): string {
    let prompt = '';
    
    if (context.issueTitle) {
      prompt += `Issue: ${context.issueTitle}\n`;
    }
    
    if (context.issueDescription) {
      prompt += `Description: ${context.issueDescription}\n`;
    }
    
    if (context.comment) {
      prompt += `\nUser comment: ${context.comment}\n`;
    }
    
    if (context.userPrompt) {
      prompt += `\nUser prompt: ${context.userPrompt}\n`;
    }
    
    if (context.previousComments && context.previousComments.length > 0) {
      prompt += '\nPrevious conversation:\n';
      context.previousComments.forEach(c => {
        prompt += `- ${c.body} (${c.createdAt})\n`;
      });
    }
    
    if (context.guidance) {
      prompt += `\nWorkspace guidance: ${context.guidance}\n`;
    }
    
    if (context.labels && context.labels.length > 0) {
      prompt += `\nLabels: ${context.labels.map(l => l.name).join(', ')}\n`;
    }
    
    if (context.priority !== undefined) {
      const priorityMap = ['None', 'Urgent', 'High', 'Normal', 'Low'];
      prompt += `\nPriority: ${priorityMap[context.priority] || 'Unknown'}\n`;
    }
    
    prompt += '\n\nProvide a helpful response following the activity format rules.';
    
    return prompt;
  }

  /**
   * Call the model (DeepSeek, Groq, or local)
   */
  private async callModel(prompt: string): Promise<string> {
    if (this.config.model.includes('deepseek')) {
      return this.callDeepSeek(prompt);
    } else if (this.config.model.includes('groq')) {
      return this.callGroq(prompt);
    } else if (this.config.model === 'local') {
      return this.callOllama(prompt);
    }
    
    throw new Error(`Unsupported model: ${this.config.model}`);
  }

  /**
   * Call DeepSeek API
   */
  private async callDeepSeek(prompt: string): Promise<string> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Call Groq API
   */
  private async callGroq(prompt: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Call local Ollama
   */
  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.message.content;
  }

  /**
   * Parse model response into structured format
   */
  private parseResponse(response: string): any {
    const typePatterns = {
      thinking: /^THINKING:\s*(.+)/i,
      action: /^ACTION:\s*(\w+)\(([^)]*)\)/i,
      response: /^RESPONSE:\s*(.+)/i,
      elicitation: /^ELICITATION:\s*(.+)/i,
      error: /^ERROR:\s*(.+)/i
    };
    
    for (const [type, pattern] of Object.entries(typePatterns)) {
      const match = response.match(pattern);
      if (match) {
        if (type === 'action') {
          return {
            type,
            tool: match[1],
            parameters: match[2],
            content: response
          };
        }
        return {
          type,
          content: match[1]?.trim() || response
        };
      }
    }
    
    // Default to response if no pattern matches
    return {
      type: 'response',
      content: response
    };
  }

  /**
   * Classify the type of request
   */
  async classifyRequest(context: AgentContext): Promise<string> {
    const prompt = `Classify this request into one of these categories:
- task_creation: Creating new tasks or issues
- complex_project: Large implementation requiring multiple steps
- code_review: Reviewing code or PRs
- bug_fix: Fixing bugs or errors
- question: Answering questions
- status_update: Providing status or progress updates
- general: Other requests

Context: ${JSON.stringify(context)}

Respond with just the category name.`;
    
    const response = await this.callModel(prompt);
    const category = response.toLowerCase().trim();
    
    // Validate category
    const validCategories = [
      'task_creation', 'complex_project', 'code_review',
      'bug_fix', 'question', 'status_update', 'general'
    ];
    
    return validCategories.includes(category) ? category : 'general';
  }

  /**
   * Extract task details from context
   */
  async extractTaskDetails(context: AgentContext): Promise<any> {
    const prompt = `Extract task details from this context:
${JSON.stringify(context)}

Provide a JSON response with:
- title: Clear, concise task title
- description: Detailed description
- labels: Array of relevant labels
- priority: Number 0-4 (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)

Respond only with valid JSON.`;
    
    const response = await this.callModel(prompt);
    
    try {
      return JSON.parse(response);
    } catch {
      // Fallback to basic extraction
      return {
        title: context.issueTitle || 'New Task',
        description: context.issueDescription || context.comment || '',
        labels: context.labels?.map(l => l.name) || [],
        priority: context.priority || 3
      };
    }
  }

  /**
   * Perform code review
   */
  async performCodeReview(codeContext: any): Promise<any> {
    const prompt = `Review this code and provide feedback:
${JSON.stringify(codeContext)}

Structure your review with:
1. Summary of changes
2. Positive aspects
3. Issues or concerns
4. Suggestions for improvement
5. Overall recommendation

Be constructive and specific.`;
    
    const response = await this.callModel(prompt);
    
    return {
      content: response,
      suggestedActions: [
        { label: 'Apply Suggestions', command: '/apply' },
        { label: 'Request Changes', command: '/changes' }
      ]
    };
  }

  /**
   * Analyze bug
   */
  async analyzeBug(context: AgentContext): Promise<any> {
    const prompt = `Analyze this bug report:
${JSON.stringify(context)}

Determine if you need more information or can provide a fix.
If you need more info, specify what questions to ask.
If you can fix it, provide the solution approach.`;
    
    const response = await this.callModel(prompt);
    const needsInfo = response.toLowerCase().includes('need') || 
                      response.toLowerCase().includes('clarify');
    
    if (needsInfo) {
      return {
        needsMoreInfo: true,
        question: 'Could you provide more details about when this bug occurs?',
        options: [
          'Always',
          'Sometimes',
          'Only with specific inputs',
          'After certain actions'
        ]
      };
    }
    
    return {
      needsMoreInfo: false,
      solution: response
    };
  }

  /**
   * Answer question
   */
  async answerQuestion(context: AgentContext): Promise<any> {
    const response = await this.processRequest(context);
    
    return {
      content: response.content,
      suggestedActions: this.getSuggestedActions(response)
    };
  }

  /**
   * Get initial thought based on context
   */
  private getInitialThought(context: AgentContext): string {
    if (context.issueTitle?.toLowerCase().includes('bug')) {
      return '🐛 Analyzing the bug report...';
    }
    if (context.issueTitle?.toLowerCase().includes('implement')) {
      return '🚀 Planning implementation approach...';
    }
    if (context.comment?.includes('?')) {
      return '💭 Processing your question...';
    }
    return '🤔 Analyzing your request...';
  }

  /**
   * Check if task is complex
   */
  private isComplexTask(context: AgentContext): boolean {
    const indicators = [
      'implement',
      'build',
      'create system',
      'develop',
      'architecture',
      'refactor'
    ];
    
    const text = `${context.issueTitle || ''} ${context.issueDescription || ''} ${context.comment || ''}`.toLowerCase();
    
    return indicators.some(indicator => text.includes(indicator));
  }

  /**
   * Get suggested actions based on response
   */
  private getSuggestedActions(response: any): Array<{ label: string; command?: string; url?: string }> {
    const actions = [];
    
    if (response.type === 'task_creation') {
      actions.push(
        { label: 'View Task', command: '/view' },
        { label: 'Add Details', command: '/details' }
      );
    }
    
    if (response.type === 'code_review') {
      actions.push(
        { label: 'Apply Suggestions', command: '/apply' },
        { label: 'Discuss', command: '/discuss' }
      );
    }
    
    return actions;
  }
}