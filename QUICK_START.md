# Quick Start - After Creating from Template

## ⚠️ IMPORTANT: Required Setup Steps

When you create a new repo from this template, you MUST complete these steps:

### 1. Install Claude Code GitHub App
```bash
# Option A: Using GitHub CLI (recommended)
gh extension install anthropics/claude-code-extension
gh claude install-app

# Option B: Manual installation
# Visit: https://github.com/apps/claude-code
# Click "Install" and select your new repository
```

### 2. Copy Secrets to New Repository
```bash
# Replace 'your-new-repo' with your actual repo name
REPO="your-username/your-new-repo"

# Copy secrets from template (requires admin access to both repos)
# LINEAR_API_KEY no longer needed - Linear syncs automatically with GitHub Issues
gh secret set PERPLEXITY_API_KEY -b "$(gh secret list -R orchidautomation/claude-code-template --json name,value | jq -r '.[] | select(.name=="PERPLEXITY_API_KEY") | .value')" -R $REPO
gh secret set ANTHROPIC_API_KEY -b "$(gh secret list -R orchidautomation/claude-code-template --json name,value | jq -r '.[] | select(.name=="ANTHROPIC_API_KEY") | .value')" -R $REPO
```

OR manually add each secret:
```bash
# LINEAR_API_KEY no longer needed - Linear syncs automatically with GitHub Issues
gh secret set PERPLEXITY_API_KEY -b "your-perplexity-key" -R your-username/your-new-repo
gh secret set ANTHROPIC_API_KEY -b "your-anthropic-key" -R your-username/your-new-repo
```

### 3. Verify Setup
Create a test issue with "@claude test" in the body and check:
- Actions tab shows the workflow running
- Claude Code responds to the mention

## Why These Steps Are Required?

- **GitHub Apps** don't transfer with templates - each repo needs its own installation
- **Secrets** are repo-specific for security - they must be added to each new repo
- **Workflow files** DO transfer (already included in template)

## Troubleshooting

### "@claude" mention not triggering
1. Check Claude Code app is installed: Settings → Integrations → GitHub Apps
2. Check secrets are set: Settings → Secrets and variables → Actions
3. Check Actions are enabled: Settings → Actions → General

### Workflow fails with "bad credentials"
- Ensure all required secrets are added to the new repository
- Linear integration works automatically via GitHub Issues Sync (if configured)

### Still not working?
Run this diagnostic:
```bash
# Check if Claude Code app is installed
gh api repos/YOUR_USERNAME/YOUR_REPO/installation

# Check if secrets are configured
gh secret list -R YOUR_USERNAME/YOUR_REPO

# Check if Actions are enabled
gh api repos/YOUR_USERNAME/YOUR_REPO | jq .has_issues,.has_projects,.has_wiki
```