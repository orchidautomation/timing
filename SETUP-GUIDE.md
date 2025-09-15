# Setup Guide - Claude Code Template

This guide walks you through setting up and using the Claude Code Linear+TaskMaster integration template.

## 📋 Prerequisites

- GitHub account with CLI installed (`gh`)
- Claude Code or compatible editor (Cursor, Windsurf, VS Code)
- Linear account with API access
- Node.js 20+ installed

## 🚀 Initial Setup Steps

### Step 1: Create Your Template Repository

1. **Navigate to the template directory**:
   ```bash
   cd ~/Documents/claude-code-template
   ```

2. **Create a new GitHub repository**:
   ```bash
   gh repo create claude-code-template --public --description "Claude Code template with Linear and TaskMaster integration"
   ```

3. **Initialize git and push the template**:
   ```bash
   git init
   git add .
   git commit -m "Initial template setup with Linear+TaskMaster integration"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/claude-code-template.git
   git push -u origin main
   ```

### Step 2: Configure as GitHub Template

1. **Open your repository on GitHub**:
   ```bash
   gh repo view --web
   ```

2. **Make it a template**:
   - Go to Settings → General
   - Under "Template repository", check ✅ the box
   - This allows you to use it as a template for new repos

### Step 3: Set Up Linear Integration

1. **Get your Linear API key**:
   - Go to Linear → Settings → API
   - Create a new personal API key
   - Copy the key for later use

2. **Install Linear MCP globally** (one-time setup):
   ```bash
   claude mcp add linear --scope user --transport sse https://mcp.linear.app/sse
   ```

3. **Enable Linear-GitHub sync**:
   - In Linear: Settings → Integrations → GitHub
   - Connect your GitHub account
   - Enable two-way sync for your teams

## 🔄 Using the Template for New Projects

### Option 1: GitHub CLI (Recommended)

```bash
# Create new project from template
gh repo create my-awesome-project --template=YOUR_USERNAME/claude-code-template --clone

# Navigate to the project
cd my-awesome-project

# Run the setup script
./setup.sh
```

### Option 2: GitHub Web Interface

1. Go to your template repository
2. Click "Use this template" → "Create a new repository"
3. Clone the new repository locally
4. Run `./setup.sh` in the project directory

### Option 3: Manual Setup

```bash
# Clone the template
git clone https://github.com/YOUR_USERNAME/claude-code-template.git my-project
cd my-project

# Remove template git history
rm -rf .git
git init

# Create new repo
gh repo create my-project --private
git add .
git commit -m "Initial commit from template"
git push -u origin main

# Run setup
./setup.sh
```

## 🔐 Environment Configuration

### GitHub Secrets (Required)

Add these secrets to your repository:

1. **Via GitHub CLI**:
   ```bash
   gh secret set LINEAR_API_KEY
   gh secret set PERPLEXITY_API_KEY  # Optional
   gh secret set ANTHROPIC_API_KEY   # Not needed with Claude Code!
   ```

2. **Via GitHub Web**:
   - Go to Settings → Secrets and variables → Actions
   - Add each secret manually

### MCP Configuration

Choose the appropriate MCP config for your editor:

- **Claude Code**: Use `mcp-claude.json` (no API keys needed!)
- **Other Editors**: Use `mcp-editor.json` (requires API keys)

Copy to your editor's config location:
```bash
# For Claude Code
cp mcp-claude.json .claude/mcp.json

# For Cursor
cp mcp-editor.json .cursor/mcp.json

# For Windsurf
cp mcp-editor.json .codeium/windsurf/mcp_config.json

# For VS Code
cp mcp-editor.json .vscode/mcp.json
```

## 📝 Project Workflow

### 1. Create Your PRD

Create a Product Requirements Document:
```bash
echo "# Project Requirements

## Overview
Describe your project here...

## Features
- Feature 1
- Feature 2

## Technical Requirements
- Requirement 1
- Requirement 2" > .taskmaster/docs/prd.txt
```

### 2. Create Linear Issue

1. Go to Linear and create a new issue
2. Add description with `@claude` mention:
   ```
   @claude Please implement the features described in our PRD.
   
   This includes user authentication, database setup, and API endpoints.
   ```

### 3. Watch the Magic

The automation will:
1. ✅ Trigger GitHub Action
2. ✅ Generate detailed PRD with TaskMaster
3. ✅ Create subtasks with dependencies
4. ✅ Update Linear with PRD and subtasks
5. ✅ Execute tasks sequentially
6. ✅ Create atomic commits
7. ✅ Open PR when complete

### 4. Monitor Progress

- **Linear**: Watch sub-issues update in real-time
- **GitHub**: See commits and PR creation
- **TaskMaster**: Check task progress with `task-master list`

## 🔧 Customization

### Modify Agents

Edit agent behaviors in `.claude/agents/`:
- `linear-prd-generator.md` - PRD generation logic
- `task-executor.md` - Task execution behavior
- `linear-sync.md` - Synchronization rules

### Adjust Workflow

Edit `.claude/workflows/linear-taskmaster.md` to change:
- Trigger conditions
- Execution order
- Error handling
- Status updates

### Configure Models

In chat or terminal:
```bash
# Use Claude Code backend (no API key)
task-master models --set-main claude-code/sonnet

# Or use API-based models
task-master models --set-main claude-3-5-sonnet-latest
task-master models --set-research perplexity/llama-3.1-sonar-large
```

## 🐛 Troubleshooting

### Issue: TaskMaster not using Claude Code

**Solution**: Ensure Claude Code CLI is installed and authenticated
```bash
claude --version
task-master models --list
```

### Issue: Linear not syncing

**Solution**: Check Linear-GitHub integration
- Verify webhook is configured
- Check Linear API key in GitHub secrets
- Ensure @claude is mentioned correctly

### Issue: GitHub Action not triggering

**Solution**: Verify Claude GitHub App installation
```bash
gh claude install-app
```

### Issue: MCP servers not working

**Solution**: Check MCP configuration
```bash
# List active MCP servers
claude mcp list

# Re-add if needed
claude mcp add taskmaster-ai --scope project
```

## 📚 Additional Resources

- [TaskMaster Documentation](https://docs.task-master.dev/)
- [Linear API Docs](https://developers.linear.app/)
- [Claude Code Docs](https://docs.anthropic.com/claude-code)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)

## 💡 Pro Tips

1. **Start Small**: Test with simple PRDs first
2. **Monitor Logs**: Check GitHub Actions logs for debugging
3. **Use Templates**: Create PRD templates for common project types
4. **Batch Updates**: Let the sync agent handle bulk updates
5. **Review PRs**: Always review auto-generated code before merging

## 🤝 Support

- **Discord**: Join the TaskMaster community
- **GitHub Issues**: Report bugs in the template repo
- **Linear**: Create support tickets with `@support` tag

---

Happy automating! 🚀