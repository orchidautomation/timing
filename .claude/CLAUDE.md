# Claude Code Project Configuration

## Available Subagents

### github-taskmaster-sync
Orchestrates TaskMaster workflow with GitHub Issues as the primary tracking system.
- Triggered by @claude mentions in GitHub issues
- Generates PRD and updates issue description
- Creates GitHub sub-issues for each task
- Executes tasks with atomic commits
- Tracks progress via issue status

### taskmaster-executor
Pure TaskMaster execution for sequential task processing.
- Parses PRD and generates tasks
- Executes tasks in dependency order
- Creates atomic commits per task
- Reports progress clearly

## MCP Servers

### Required
- **taskmaster-ai**: Task management and PRD generation (v0.18+)
  - Supports multiple AI providers (Anthropic, OpenAI, Perplexity, etc.)
  - Claude Code support: `sonnet --claude-code` or `opus --claude-code` (no API key needed in local)
  - Research model: Can use Perplexity for up-to-date information
  - Fallback models: Automatic failover if primary model fails
  
- **github**: Repository operations
  - Requires GITHUB_TOKEN in environment
  - Used for issue management and PR creation

## Workflows

### GitHub-TaskMaster Integration
**Trigger**: @claude mention in GitHub issue

**Process**:
1. Extract issue details from GitHub
2. Generate PRD using TaskMaster
3. Update GitHub issue with PRD
4. Create GitHub sub-issues for each task
5. Execute tasks sequentially
6. Close sub-issues as tasks complete
7. Create PR when all tasks done

**Benefits**:
- Everything stays in GitHub (no external dependencies)
- Clear hierarchy: Parent issue → Sub-issues → Commits
- Full traceability and audit trail
- Works with existing GitHub workflows
- If Linear is configured, issues sync automatically via GitHub Issues Sync

## Rules and Best Practices

### Task Management
- Always use TaskMaster for complex tasks or when explicitly mentioned
- Create atomic commits for each subtask
- Update GitHub issues in real-time during execution
- Respect task dependencies

### GitHub Integration
- PRD goes in issue description
- Each TaskMaster task becomes a GitHub sub-issue (properly linked via API)
- **CRITICAL**: All sub-issues MUST start with "@claude - " to trigger automation
- Sub-issues are created using three-step process:
  1. Create issue with `gh issue create` and capture output
  2. Extract issue number from output
  3. Link as sub-issue with `gh api` to `/sub_issues` endpoint
- Reference issues in commits: "Closes #XX"
- Link all PRs to parent issues

### Code Quality
- Follow existing code conventions
- Use project's existing libraries
- Create incremental, testable changes
- Run linting and tests before committing

### Model Configuration (TaskMaster v0.18+)
- Primary model: `sonnet --claude-code` (no API key needed locally)
- In GitHub Actions: Requires ANTHROPIC_API_KEY
- Research model: Perplexity (optional, requires API key)

## Environment Variables

Required in GitHub Actions:
```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }} # Optional
```

## Command Examples

Initialize TaskMaster:
```
Initialize taskmaster-ai in my project
```

Set models (v0.18+):
```
Change the main model to sonnet --claude-code
# Or via CLI:
task-master models --set-main sonnet --claude-code
```

Parse PRD:
```
Parse my PRD and generate tasks
```

Execute next task:
```
What's the next task and can you implement it?
```

## Project Structure

```
.claude/
├── agents/           # Subagent definitions
├── mcp.json         # MCP server configuration
└── CLAUDE.md        # This file

.taskmaster/
├── docs/            # PRDs and documentation
├── tasks/           # Generated task files
└── config.json      # TaskMaster configuration

.github/
└── workflows/
    └── claude-code.yml  # GitHub Actions workflow
```

## Troubleshooting

### TaskMaster not using Claude Code (v0.18+)
- Run `task-master models` to verify
- Use `task-master models --set-main sonnet --claude-code`
- Or `task-master models --set-main opus --claude-code`
- No API key should be required locally

### GitHub issues not updating
- Check GITHUB_TOKEN permissions
- Verify Claude Code app is installed
- Check workflow logs in Actions tab

### Tasks not executing
- Verify dependencies are met
- Check TaskMaster initialization
- Review task status in GitHub issues