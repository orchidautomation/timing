# Linear TaskMaster Bot

A Linear bot that integrates with TaskMaster for AI-powered task management. Only activates when explicitly called with `/taskmaster` commands.

## Features

- **Parse PRDs**: Convert Linear issue descriptions into TaskMaster tasks
- **Expand Tasks**: Break down complex tasks into subtasks
- **Status Tracking**: View task progress
- **GitHub Sync**: Create GitHub issues for Claude Code processing
- **Optional Integration**: Only runs when you explicitly use commands

## Commands

- `/taskmaster parse` - Generate tasks from issue description
- `/taskmaster expand [task-id]` - Break down a task into subtasks
- `/taskmaster status` - Show current task progress
- `/taskmaster sync` - Sync issue to GitHub
- `/taskmaster help` - Show available commands

## Deployment Options

### Option 1: Railway (Recommended)

1. Fork this repository
2. Connect Railway to your GitHub
3. Create new project from the repo
4. Set environment variables:
   ```
   LINEAR_API_KEY=your_linear_api_key
   LINEAR_WEBHOOK_SECRET=generate_random_secret
   GITHUB_TOKEN=your_github_token (optional)
   GITHUB_REPO=owner/repo (optional)
   ```
5. Deploy!

### Option 2: VPS with Coolify

1. Create new service in Coolify
2. Use this repository as source
3. Set environment variables
4. Deploy as Node.js application

### Option 3: Local Development

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Fill in your credentials
4. Run:
   ```bash
   npm install
   npm run dev
   ```

## Setting Up Linear Webhook

1. Go to Linear Settings → API → Webhooks
2. Create new webhook
3. Set URL to: `https://your-bot-url/webhook`
4. Select events: "Comment created"
5. Copy the webhook secret to `LINEAR_WEBHOOK_SECRET`

## How It Works

1. You type `/taskmaster parse` in a Linear issue comment
2. Bot reads the issue description
3. Generates TaskMaster tasks
4. Updates the issue with task list
5. Optionally syncs to GitHub for Claude Code processing

## Environment Variables

- `LINEAR_API_KEY` - Your Linear API key (required)
- `LINEAR_WEBHOOK_SECRET` - Webhook validation secret (required)
- `GITHUB_TOKEN` - GitHub personal access token (optional, for sync)
- `GITHUB_REPO` - Target GitHub repository (optional, format: owner/repo)
- `PORT` - Server port (default: 3000)

## Integration with Claude Code Template

This bot is designed to work with the [claude-code-template](https://github.com/orchidautomation/claude-code-template) project. When you sync an issue to GitHub, it will be picked up by Claude Code automation for processing.

## Security

- Validates webhook signatures
- Only responds to explicit commands
- Requires authentication for all API calls
- No automatic processing without user action