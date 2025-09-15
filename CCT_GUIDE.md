# CCT (Claude Code Template) - Complete Guide

## 🚀 Quick Start

### Install Once (Already Done!)
```bash
./install-user.sh
```

### Create Projects Instantly
```bash
cct my-awesome-project
```

That's it! One command creates everything.

---

## 📖 What is CCT?

CCT is your shortcut command for creating AI-powered projects with Claude Code, Linear, and TaskMaster integration. Just like `cc` is your shortcut for Claude Code, `cct` creates complete project setups in seconds.

## 🎯 The Problem It Solves

**Before CCT (The Clunky Way):**
1. Go to GitHub website
2. Find template, click "Use this template"
3. Create repository
4. Clone locally
5. Run setup scripts
6. Install Claude Code app manually
7. Add secrets one by one
8. Test if it works

**With CCT (The Magic Way):**
```bash
cct my-project
```
Done! Everything is set up and ready.

## 🔧 Installation

### First Time Setup (One-Time Only)

1. **Install the CCT command:**
```bash
cd claude-code-template
./install-user.sh
```

2. **Set up your API keys (One-Time):**
```bash
cct --setup-keys
```

You'll be prompted for:
- `LINEAR_API_KEY` - Get from https://linear.app/settings/api (REQUIRED)
- `ANTHROPIC_API_KEY` - Optional with Claude Code backend
- `PERPLEXITY_API_KEY` - Optional for research

These are saved to `~/.claude-code-template/secrets.env` and reused for all future projects.

## 📝 Commands

### Create New Project (From Template)
```bash
cct <project-name>
```

Examples:
```bash
cct todo-backend
cct my-saas-app
cct experimental-ai-tool
```

### Add Claude to Existing Project
```bash
cd your-existing-project
cct-add
```

This adds Claude Code automation to any existing GitHub repository!

### Update API Keys
```bash
cct --setup-keys
```

### Get Help
```bash
cct --help
```

## 🔄 Complete Workflow

### 1. Create Project from Anywhere
```bash
cd ~/Desktop           # Or anywhere you want
cct my-new-project    # Creates and sets up everything
```

### 2. What Happens Automatically
- ✅ Creates GitHub repo from template
- ✅ Clones it to current directory
- ✅ Installs Claude Code GitHub App
- ✅ Copies your saved API keys as GitHub secrets
- ✅ Initializes TaskMaster
- ✅ Creates test issue with @claude mention
- ✅ Ready for AI-powered development!

### 3. Start Working
```bash
cd my-new-project
# Create issue: "@claude implement user authentication"
# Watch Claude work its magic in GitHub Actions!
```

## 🔐 How Secrets Work

### Your Setup (Already Configured)
```
~/.claude-code-template/secrets.env
├── LINEAR_API_KEY='lin_api_...'
├── PERPLEXITY_API_KEY='pplx_...'
└── ANTHROPIC_API_KEY='sk-ant_...'
```

### Per-Project Flow
1. **Local Storage**: Keys saved once in `~/.claude-code-template/secrets.env`
2. **Auto-Copy**: `cct` reads from local → copies to GitHub secrets
3. **Cloud Ready**: GitHub Actions can now use them (works from anywhere!)

### Why This Way?
- **GitHub Limitation**: No user-level secrets for personal accounts
- **Our Solution**: Store locally, auto-apply to each repo
- **Result**: One-time setup, works forever!

## 🌍 Works From Anywhere

Once a project is created with `cct`:

- **From Linear**: "@claude do this" → Works!
- **From GitHub**: "@claude fix that" → Works!
- **From Your Phone**: "@claude update this" → Works!
- **Your Computer Off**: Still works! (runs in GitHub's cloud)

## 🛠️ Troubleshooting

### "cct: command not found"
```bash
# Reinstall
cd claude-code-template
./install-user.sh

# Reload shell
source ~/.zshrc  # or ~/.bashrc
```

### "@claude not responding"
1. Check Claude Code app is installed:
   - Go to: `https://github.com/YOUR_USER/YOUR_REPO/settings/installations`
   
2. Check secrets are set:
   ```bash
   gh secret list -R YOUR_USER/YOUR_REPO
   ```

3. Check Actions tab for workflow runs

### "API key issues"
```bash
# Update your saved keys
cct --setup-keys
```

## 📂 File Structure

After running `cct my-project`:
```
my-project/
├── .github/
│   └── workflows/
│       ├── claude-code.yml      # Auto-triggers on @claude
│       └── test-linear.yml       # Test Linear connection
├── .claude/
│   ├── agents/                  # AI agent definitions
│   ├── workflows/                # Workflow definitions
│   └── mcp.json                 # MCP configuration
├── .taskmaster/
│   └── docs/                    # PRDs go here
└── setup-new-repo.sh            # Manual setup if needed
```

## 🎯 Real-World Examples

### Create a SaaS Backend
```bash
cct saas-backend
cd saas-backend
# Create issue: "@claude implement Stripe subscription system with webhooks"
```

### Build a CLI Tool
```bash
cct my-cli-tool
cd my-cli-tool
# Create issue: "@claude create a CLI for file organization with progress bars"
```

### Start a Web App
```bash
cct nextjs-app
cd nextjs-app
# Create issue: "@claude set up Next.js 14 with TypeScript, Tailwind, and Supabase"
```

## 🔍 Behind the Scenes

When you run `cct project-name`:

1. **Creates GitHub Repo**
   ```bash
   gh repo create project-name --template=orchidautomation/claude-code-template
   ```

2. **Installs Claude Code App**
   - Opens browser if needed
   - Waits for confirmation

3. **Sets GitHub Secrets**
   ```bash
   gh secret set LINEAR_API_KEY -b "$LINEAR_API_KEY"
   gh secret set PERPLEXITY_API_KEY -b "$PERPLEXITY_API_KEY"
   ```

4. **Creates Test Issue**
   ```bash
   gh issue create -t "@claude ready?" -b "@claude - say hello!"
   ```

## 💡 Pro Tips

### Use Descriptive Project Names
```bash
# Good
cct invoice-management-api
cct react-dashboard-v2

# Less Good
cct project1
cct test
```

### Check Actions Immediately
After creating, always check:
```bash
open "https://github.com/YOUR_USER/YOUR_PROJECT/actions"
```

### Create Linear Team Per Project
In Linear, create a team with the same name as your GitHub repo for best integration.

## 🔗 Related Resources

- **Template Repo**: https://github.com/orchidautomation/claude-code-template
- **Linear API**: https://linear.app/settings/api
- **Claude Code App**: https://github.com/apps/claude-code
- **TaskMaster Docs**: https://docs.task-master.dev/

## 🔄 Adding to Existing Projects

Have an existing repo? No problem!

### Method 1: Using `cct-add` (Recommended)
```bash
cd your-existing-project
cct-add
```

This will:
1. Download Claude Code configuration files
2. Install Claude Code GitHub App
3. Set up GitHub secrets (using your saved keys)
4. Initialize TaskMaster (optional)
5. Commit and push changes
6. Create test issue to verify

### Method 2: Manual Script
```bash
cd your-existing-project
curl -sL https://raw.githubusercontent.com/orchidautomation/claude-code-template/main/add-to-existing.sh | bash
```

### What Gets Added
- `.github/workflows/claude-code.yml` - GitHub Actions workflow
- `.claude/` directory with agents and workflows
- `.taskmaster/` directory for PRDs
- All necessary configuration files

Your existing code remains untouched - we only add the automation layer!

## 📜 Summary

**Two Commands to Remember:**

For NEW projects:
```bash
cct my-new-project
```

For EXISTING projects:
```bash
cd existing-project && cct-add
```

This replaces a 6-step manual process with instant automation. Your API keys are saved locally once and automatically applied to every project. Claude responds to @mentions from anywhere - Linear, GitHub, or mobile - without your computer being on.

**Command Reference**: 
- `cc` = Run Claude Code locally
- `cct` = Create new Claude Template project
- `cct-add` = Add Claude to existing project

Happy coding! 🚀