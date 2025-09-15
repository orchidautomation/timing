# TaskMaster Integration Guide

## Overview
This template includes full TaskMaster integration for AI-driven task management.

## Quick Setup

### 1. Models Configuration
TaskMaster supports three model types:
- **Main Model**: Primary AI for task generation
- **Research Model**: For fetching real-time information
- **Fallback Model**: Backup if main/research fails

### 2. Available Models

#### No API Key Required (TaskMaster v0.18+)
- `sonnet --claude-code` - Claude Sonnet via Claude Code CLI
- `opus --claude-code` - Claude Opus via Claude Code CLI

#### With API Keys
| Provider | Models | Best For | API Key Env |
|----------|--------|----------|-------------|
| Anthropic | claude-3-5-sonnet-latest, claude-3-opus | General tasks | ANTHROPIC_API_KEY |
| OpenAI | gpt-4o, gpt-4-turbo | Code generation | OPENAI_API_KEY |
| Perplexity | llama-3.1-sonar-* | Research with web access | PERPLEXITY_API_KEY |
| Google | gemini-pro, gemini-1.5-pro | Multi-modal tasks | GOOGLE_API_KEY |
| xAI | grok-beta | Latest information | XAI_API_KEY |
| OpenRouter | 100+ models | Model variety | OPENROUTER_API_KEY |

### 3. Recommended Configurations

#### Best Free Setup (Claude Code only - v0.18+)
```
# Via chat:
Change the main model to sonnet --claude-code

# Via CLI:
task-master models --set-main sonnet --claude-code
```

#### Best with API Keys
```
Change the main model to claude-3-5-sonnet-latest
Change the research model to perplexity/llama-3.1-sonar-large-128k-online
Change the fallback model to gpt-4o
```

#### Budget Setup
```
Change the main model to gemini-pro
Change the research model to perplexity/llama-3.1-sonar-small-128k-online
```

## Common TaskMaster Commands

### In Chat (MCP)
```
Initialize taskmaster-ai in my project
Parse my PRD at .taskmaster/docs/prd.txt
What's the next task I should work on?
Can you help me implement task 3?
Show me tasks 1, 3, and 5
Expand task 4 into subtasks
Research the latest Next.js 14 best practices
```

### Command Line
```bash
# Initialize project
task-master init --rules claude

# Parse PRD and generate tasks
task-master parse-prd .taskmaster/docs/prd.txt

# View tasks
task-master list
task-master next
task-master show 1,3,5

# Manage tasks
task-master expand 4
task-master update 3 --status done
task-master add "New feature: Add dark mode"

# Research
task-master research "Latest React patterns"
```

## PRD Best Practices

### Location
- New projects: `.taskmaster/docs/prd.txt`
- Legacy projects: `scripts/prd.txt`

### Structure
```
# Project Name

## Overview
Brief description of the project

## Core Features
1. Feature 1
   - Requirement A
   - Requirement B
2. Feature 2
   - Requirement C

## Technical Requirements
- Framework: Next.js 14
- Database: PostgreSQL
- Auth: Clerk

## User Stories
As a [user type], I want to [action] so that [benefit]

## Success Criteria
- [ ] Criteria 1
- [ ] Criteria 2
```

## Workflow Integration

### Linear → TaskMaster Flow
1. Create Linear issue with requirements
2. @claude generates PRD from issue
3. TaskMaster parses PRD into tasks
4. Tasks sync back to Linear as sub-issues
5. Implementation begins sequentially

### TaskMaster → GitHub Flow
1. TaskMaster creates task breakdown
2. Each task becomes a commit
3. Tasks complete in dependency order
4. PR created with all changes
5. Links back to Linear issue

## Advanced Features

### Tags System
```bash
# Create workspace tags
task-master add-tag feature-x
task-master use-tag feature-x

# Move tasks between tags
task-master move --from=5 --from-tag=backlog --to-tag=in-progress
```

### Dependency Management
```bash
# Add dependencies
task-master add-dependency --id=5 --depends-on=3

# View dependency tree
task-master deps --tree

# Check for circular dependencies
task-master validate-dependencies
```

### Bulk Operations
```bash
# Update multiple tasks
task-master update 1,2,3 --status=done

# Expand all pending tasks
task-master expand-all

# Scope up/down complexity
task-master scope-up 5 --strength=heavy
task-master scope-down 8 --strength=light
```

## Troubleshooting

### "No API key found"
- Use Claude Code models (no key needed)
- Or add at least one API key to secrets

### "Model not available"
- Check API key is set for that provider
- Verify model name is correct
- Try fallback model

### "TaskMaster not initialized"
```bash
npx task-master-ai init --yes --rules claude
```

### "Can't parse PRD"
- Ensure PRD exists at `.taskmaster/docs/prd.txt`
- Check PRD format is readable
- Try with simpler PRD first

## Tips & Tricks

1. **Start Simple**: Begin with a basic PRD, expand later
2. **Use Research**: For latest tech info, use research model
3. **Atomic Tasks**: Keep tasks small and focused
4. **Clear Dependencies**: Define task order clearly
5. **Regular Sync**: Keep Linear and TaskMaster in sync
6. **Commit Often**: Each task completion = one commit
7. **Review PRs**: Always review AI-generated code

## Model Performance Comparison

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| sonnet --claude-code | Fast | High | Free | Most tasks (v0.18+) |
| opus --claude-code | Medium | Highest | Free | Complex tasks (v0.18+) |
| claude-3-5-sonnet | Fast | Highest | $$ | Production code |
| gpt-4o | Fast | High | $$ | Code review |
| perplexity/sonar | Medium | High | $ | Research |
| gemini-pro | Fast | Good | $ | Budget option |

## Integration with CI/CD

TaskMaster works in GitHub Actions:
```yaml
- name: Parse PRD
  run: |
    npx task-master-ai parse-prd .taskmaster/docs/prd.txt
    
- name: Execute Next Task
  run: |
    TASK_ID=$(npx task-master-ai next --json | jq -r '.id')
    echo "Implementing task $TASK_ID"
```

---

For more info: [TaskMaster Docs](https://docs.task-master.dev/)