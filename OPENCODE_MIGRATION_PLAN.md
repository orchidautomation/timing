# Claude Code to OpenCode Migration Plan

## Executive Summary

This document outlines a comprehensive migration strategy from Claude Code to OpenCode for the `claude-code-template` repository. The primary motivation is to reduce API costs by ~95% while maintaining equivalent functionality for GitHub Actions automation.

**Key Benefits:**
- **Cost Reduction**: From $3-15/1M tokens (Claude) to $0.14/1M tokens (DeepSeek) or free (local models)
- **Open Source**: No vendor lock-in, full control over the automation pipeline
- **Native GitHub Integration**: Purpose-built for GitHub Actions workflows
- **Model Flexibility**: Use any LLM provider or local models

## Current State Analysis

### Existing Infrastructure

#### 1. Claude Code Implementation
- **Action**: `anthropics/claude-code-action@v1`
- **API Usage**: Direct Anthropic API calls in GitHub Actions
- **Cost Issue**: Not using Claude MAX subscription, hitting API directly
- **Workflow**: `.github/workflows/claude-code.yml`

#### 2. Core Components
- **TaskMaster Integration**: v0.25.1+ for task management
- **MCP Servers**: taskmaster-ai, github
- **Subagents**: github-taskmaster-sync, taskmaster-executor
- **Task Tracking**: TodoWrite for progress visibility

#### 3. Workflow Triggers
- Issue comments with `@claude` mention
- Issue creation/editing
- Pull request events
- Manual workflow dispatch

### Cost Analysis

| Component | Current Cost | OpenCode Cost | Savings |
|-----------|-------------|---------------|---------|
| Claude Sonnet 3.5 | $3-15/1M tokens | - | - |
| DeepSeek R1 | - | $0.14/1M tokens | 95%+ |
| Groq Llama | - | ~$0.10/1M tokens | 96%+ |
| Local Models | - | $0 (infrastructure only) | 100% |

## Migration Strategy

### Phase 1: Preparation (Week 1)

#### 1.1 Environment Setup
```bash
# Install OpenCode locally for testing
curl -fsSL https://opencode.ai/install | bash

# Or via npm
npm install -g opencode-ai

# Verify installation
opencode --version
```

#### 1.2 API Key Acquisition
Choose cost-effective providers:

**Option A: DeepSeek (Recommended)**
- Register at [platform.deepseek.com](https://platform.deepseek.com)
- Generate API key
- Cost: ~$0.14/1M tokens

**Option B: Groq**
- Register at [console.groq.com](https://console.groq.com)
- Generate API key
- Cost: ~$0.10/1M tokens

**Option C: Local Models (Zero API Cost)**
- Install Ollama: `brew install ollama`
- Pull models: `ollama pull llama3.2`
- Configure OpenCode for local inference

#### 1.3 Local Testing Environment
```bash
# Clone your repository
git clone https://github.com/your-org/claude-code-template
cd claude-code-template

# Configure OpenCode
opencode auth login
# Select provider (DeepSeek/Groq/Other)
# Enter API key

# Initialize OpenCode for the project
opencode
/init

# Test basic functionality
/models  # Select model
```

### Phase 2: GitHub Integration (Week 1-2)

#### 2.1 Install GitHub App
```bash
# Run in your project directory
opencode github install

# This will:
# 1. Open browser to install GitHub app
# 2. Create workflow file
# 3. Guide through secret setup
```

#### 2.2 Create OpenCode Workflow
Create `.github/workflows/opencode.yml`:

```yaml
name: OpenCode AI Assistant

on:
  issue_comment:
    types: [created]
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, synchronize]

jobs:
  opencode:
    if: |
      contains(github.event.comment.body, '/oc') ||
      contains(github.event.comment.body, '/opencode') ||
      contains(github.event.comment.body, '@claude') ||
      contains(github.event.issue.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: write
      pull-requests: write
      issues: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install TaskMaster
        run: |
          npm install -g task-master-ai@latest
          
      - name: Initialize TaskMaster
        if: ${{ !contains(github.event.repository.topics, 'taskmaster-initialized') }}
        run: |
          task-master init --yes --rules opencode
          
      - name: Configure TaskMaster Models
        run: |
          # Configure TaskMaster to use the same model as OpenCode
          if [ -n "${{ secrets.DEEPSEEK_API_KEY }}" ]; then
            task-master models --set-main deepseek/deepseek-r1-distill-llama-3.2-8b
          elif [ -n "${{ secrets.GROQ_API_KEY }}" ]; then
            task-master models --set-main groq/llama-3.3-70b-instruct
          fi
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          
      - name: Run OpenCode
        uses: sst/opencode/github@latest
        env:
          # Primary model API key (choose one)
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          # GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          # OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          
          # Optional: Keep Perplexity for research
          PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}
          
          # GitHub token for operations
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          # Model configuration (update based on chosen provider)
          model: deepseek/deepseek-r1-distill-llama-3.2-8b
          # model: groq/llama-3.3-70b-instruct
          # model: openai/gpt-4o-mini
          
          # Optional: Share sessions publicly (default: true for public repos)
          share: true
          
          # Optional: Use custom GitHub token instead of app token
          # token: ${{ secrets.GITHUB_TOKEN }}
```

#### 2.3 Repository Secrets Configuration
Add to GitHub Settings → Secrets and variables → Actions:

```bash
# Required (choose one primary model provider)
DEEPSEEK_API_KEY=your_deepseek_key
# OR
GROQ_API_KEY=your_groq_key

# Optional (for enhanced features)
PERPLEXITY_API_KEY=your_perplexity_key  # For research tasks
GITHUB_TOKEN=already_available          # Automatically provided
```

### Phase 3: TaskMaster Integration (Week 2)

#### 3.1 Update TaskMaster Configuration
Create/update `.taskmaster/config.json`:

```json
{
  "version": "0.25.1",
  "models": {
    "main": {
      "provider": "deepseek",
      "model": "deepseek-r1-distill-llama-3.2-8b",
      "apiKey": "${DEEPSEEK_API_KEY}"
    },
    "research": {
      "provider": "perplexity",
      "model": "sonar-pro",
      "apiKey": "${PERPLEXITY_API_KEY}"
    },
    "fallback": {
      "provider": "groq",
      "model": "llama-3.3-70b-instruct",
      "apiKey": "${GROQ_API_KEY}"
    }
  },
  "features": {
    "autoExpand": true,
    "githubIntegration": true,
    "atomicCommits": true
  }
}
```

#### 3.2 Adapt AGENTS.md for OpenCode
Create/update `AGENTS.md` in project root:

```markdown
# OpenCode Agent Configuration

## Project Overview
[Your project description]

## Coding Patterns
- Language: [JavaScript/TypeScript/Python/etc]
- Framework: [React/Next.js/etc]
- Style: [Your coding style preferences]

## Agent Instructions

### GitHub Integration
When mentioned with /opencode or /oc in GitHub:
1. Triage and understand the issue
2. Create a branch for changes
3. Implement fixes/features
4. Submit PR with clear description
5. Reference issue numbers in commits

### TaskMaster Integration
When complex tasks require planning:
1. Use TaskMaster for task breakdown
2. Create GitHub sub-issues for tracking
3. Execute tasks sequentially
4. Update status after each task
5. Create atomic commits

### Code Quality
- Follow existing patterns
- Write tests when applicable
- Run linting before commits
- Create clear commit messages
```

### Phase 4: Testing & Validation (Week 2-3)

#### 4.1 Create Test Issues
Test various scenarios in a staging repository:

```markdown
# Test Issue 1: Simple Fix
@claude Fix the typo in README.md

# Test Issue 2: Feature Request  
/opencode Add a new utility function for date formatting

# Test Issue 3: Complex Task with TaskMaster
/oc Use taskmaster to implement a user authentication system

# Test Issue 4: Code Review
/opencode Review and optimize the performance of src/utils/data.js
```

#### 4.2 Validation Checklist
- [ ] OpenCode responds to mentions
- [ ] Creates branches correctly
- [ ] Submits PRs with proper formatting
- [ ] TaskMaster integration works
- [ ] Sub-issues are created when needed
- [ ] Commits reference issues
- [ ] Code changes are appropriate
- [ ] Tests pass (if applicable)

#### 4.3 Performance Comparison

| Metric | Claude Code | OpenCode | Notes |
|--------|------------|----------|-------|
| Response Time | ~30s | ~20s | Model dependent |
| Code Quality | High | High | With proper model |
| Task Completion | 95% | 90%+ | Depends on complexity |
| Cost per Task | $0.50-2.00 | $0.02-0.10 | 95% reduction |

### Phase 5: Migration Execution (Week 3)

#### 5.1 Parallel Run Strategy
Run both systems in parallel initially:

1. Keep Claude workflow as `claude-code.yml`
2. Add OpenCode workflow as `opencode.yml`
3. Use different triggers:
   - Claude: `@claude` mentions
   - OpenCode: `/oc` or `/opencode` commands

#### 5.2 Progressive Rollout
```bash
# Week 1: Testing team only
# Week 2: Development team
# Week 3: All contributors
# Week 4: Deprecate Claude workflow
```

#### 5.3 Update Documentation
Update `README.md`:

```markdown
## AI Assistant

This repository uses OpenCode for AI-powered automation.

### Usage
- Mention `/opencode` or `/oc` in issues or PRs
- Example: `/oc fix this bug`
- For complex tasks: `/opencode use taskmaster to implement [feature]`

### Available Commands
- `/oc explain` - Explain an issue or code
- `/oc fix` - Fix bugs or issues
- `/oc implement` - Implement new features
- `/oc review` - Review code changes
```

### Phase 6: Optimization (Week 4+)

#### 6.1 Model Selection Strategy
```javascript
// Model selection based on task complexity
const modelSelection = {
  simple: "groq/llama-3.3-70b-instruct",     // Fast, cheap
  moderate: "deepseek/deepseek-r1-distill",   // Balanced
  complex: "openai/gpt-4o",                   // High quality
  research: "perplexity/sonar-pro"            // Web search
};
```

#### 6.2 Custom Commands
Create `.opencode/commands/` directory:

```markdown
# .opencode/commands/test.md
Run the test suite and report results

## Steps
1. Run `npm test`
2. Capture output
3. Summarize failures
4. Suggest fixes
```

#### 6.3 Performance Tuning
Configure `.opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": {
    "default": "deepseek/deepseek-r1-distill-llama-3.2-8b",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "features": {
    "autoFormat": true,
    "gitIntegration": true,
    "sessionCompaction": true
  },
  "provider": {
    "deepseek": {
      "options": {
        "baseURL": "https://api.deepseek.com/v1"
      }
    }
  }
}
```

## Rollback Plan

### Immediate Rollback
If critical issues occur:

1. **Disable OpenCode workflow**:
```bash
mv .github/workflows/opencode.yml .github/workflows/opencode.yml.disabled
```

2. **Re-enable Claude workflow**:
```bash
# Ensure claude-code.yml is active
git revert [migration-commit]
```

3. **Notify team**:
```markdown
⚠️ Reverting to Claude Code due to [issue description]
Please use @claude mentions until further notice
```

### Gradual Rollback
For non-critical issues:

1. Keep both workflows active
2. Route complex tasks to Claude
3. Use OpenCode for simple tasks
4. Debug issues in parallel

## Success Metrics

### Week 1 Targets
- [ ] 50% reduction in API costs
- [ ] 90% task success rate
- [ ] <1 minute response time

### Month 1 Targets
- [ ] 95% reduction in API costs
- [ ] 95% task success rate
- [ ] Full feature parity with Claude Code
- [ ] Team satisfaction score >4/5

### Monitoring

#### Cost Tracking
```python
# Track API usage
import datetime
import json

def track_usage(provider, tokens, cost):
    entry = {
        "date": datetime.datetime.now().isoformat(),
        "provider": provider,
        "tokens": tokens,
        "cost": cost
    }
    with open("usage_log.json", "a") as f:
        f.write(json.dumps(entry) + "\n")
```

#### Performance Metrics
- Response time per request
- Task completion rate
- Error frequency
- User satisfaction

## Troubleshooting Guide

### Common Issues

#### Issue 1: OpenCode not responding
**Solution**:
```bash
# Check workflow logs
gh run list --workflow=opencode.yml
gh run view [run-id]

# Verify triggers in workflow
grep -A5 "if:" .github/workflows/opencode.yml
```

#### Issue 2: Model API errors
**Solution**:
```bash
# Verify API key
echo $DEEPSEEK_API_KEY | head -c 10

# Test API directly
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

#### Issue 3: TaskMaster integration failing
**Solution**:
```bash
# Reinitialize TaskMaster
task-master init --yes --force

# Verify configuration
task-master models
```

## Support Resources

### Documentation
- [OpenCode Docs](https://opencode.ai/docs)
- [OpenCode GitHub](https://github.com/sst/opencode)
- [Model Providers Guide](https://opencode.ai/docs/providers)

### Community
- OpenCode Discord: [Join Discord](https://discord.gg/opencode)
- GitHub Issues: [Report Issues](https://github.com/sst/opencode/issues)

### Migration Support Contacts
- Technical Lead: [Your contact]
- DevOps Team: [Team contact]
- Emergency Escalation: [Escalation path]

## Appendix

### A. Model Comparison Table

| Model | Provider | Cost/1M | Speed | Quality | Best For |
|-------|----------|---------|-------|---------|----------|
| DeepSeek R1 | DeepSeek | $0.14 | Fast | High | General coding |
| Llama 3.3 70B | Groq | $0.10 | Very Fast | Good | Simple tasks |
| GPT-4o Mini | OpenAI | $0.15 | Fast | High | Complex logic |
| Claude Sonnet | Anthropic | $3-15 | Medium | Excellent | Complex reasoning |
| Local Llama | Ollama | $0 | Variable | Good | Privacy-sensitive |

### B. Cost Calculation

```python
# Monthly cost estimation
def calculate_monthly_cost(daily_requests, avg_tokens_per_request, cost_per_million):
    monthly_tokens = daily_requests * avg_tokens_per_request * 30
    monthly_millions = monthly_tokens / 1_000_000
    return monthly_millions * cost_per_million

# Example
claude_cost = calculate_monthly_cost(100, 5000, 15)  # $225/month
opencode_cost = calculate_monthly_cost(100, 5000, 0.14)  # $2.10/month
savings = claude_cost - opencode_cost  # $222.90/month saved
```

### C. Sample GitHub Action Logs

```bash
# Successful OpenCode execution
Run sst/opencode/github@latest
  Installing OpenCode...
  Configuring model: deepseek/deepseek-r1-distill-llama-3.2-8b
  Processing issue #123: "Fix authentication bug"
  Creating branch: fix/issue-123-auth-bug
  Making changes...
  Creating PR #124: "fix: resolve authentication bug in login flow"
  ✅ Task completed successfully
```

## Conclusion

This migration plan provides a comprehensive path from Claude Code to OpenCode, prioritizing:
1. **Cost reduction** (95%+ savings)
2. **Minimal disruption** (parallel run strategy)
3. **Feature parity** (maintaining all capabilities)
4. **Team adoption** (gradual rollout)

The migration can be completed in 3-4 weeks with proper planning and testing. The investment will pay off immediately through reduced API costs while maintaining automation quality.

---

*Document Version: 1.0*  
*Last Updated: 2025-01-09*  
*Next Review: After Phase 1 completion*