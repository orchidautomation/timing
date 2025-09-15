#!/bin/bash

# Setup script for new repos created from claude-code-template
# Run this after creating a new repo from the template

set -e

echo "🚀 Claude Code Template - New Repository Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current repo info
CURRENT_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")

if [ -z "$CURRENT_REPO" ]; then
    echo -e "${RED}Error: Not in a GitHub repository or gh CLI not configured${NC}"
    echo "Please run this script from your new repository directory"
    exit 1
fi

echo -e "${BLUE}Setting up repository: $CURRENT_REPO${NC}"
echo ""

# Step 1: Install Claude Code GitHub App
echo "📱 Step 1: Installing Claude Code GitHub App..."
echo "----------------------------------------"

# Check if app is already installed
if gh api repos/$CURRENT_REPO/installation &>/dev/null; then
    echo -e "${GREEN}✓ Claude Code app already installed${NC}"
else
    echo "Installing Claude Code GitHub App..."
    
    # Try to install via CLI extension
    if ! gh extension list | grep -q "claude-code"; then
        echo "Installing Claude extension..."
        gh extension install anthropics/claude-code-extension 2>/dev/null || {
            echo -e "${YELLOW}⚠ Could not install extension automatically${NC}"
            echo ""
            echo "Please install manually:"
            echo "1. Visit: https://github.com/apps/claude-code"
            echo "2. Click 'Install' and select: $CURRENT_REPO"
            echo ""
            read -p "Press Enter after installing the app..."
        }
    fi
    
    # Try to install app
    gh claude install-app 2>/dev/null || {
        echo -e "${YELLOW}⚠ Could not install app automatically${NC}"
        echo ""
        echo "Please install manually:"
        echo "1. Visit: https://github.com/apps/claude-code"
        echo "2. Click 'Install' and select: $CURRENT_REPO"
        echo ""
        read -p "Press Enter after installing the app..."
    }
fi

# Step 2: Set up secrets
echo ""
echo "🔐 Step 2: Setting up GitHub Secrets..."
echo "----------------------------------------"

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    local is_required=$3
    
    if [ -z "$secret_value" ]; then
        if [ "$is_required" = "true" ]; then
            echo -e "${YELLOW}⚠ $secret_name is required but not provided${NC}"
            read -sp "Enter $secret_name: " value
            echo ""
            if [ ! -z "$value" ]; then
                gh secret set $secret_name -b "$value" -R $CURRENT_REPO
                echo -e "${GREEN}✓ $secret_name added${NC}"
            else
                echo -e "${RED}✗ $secret_name skipped (required for full functionality)${NC}"
            fi
        else
            echo -e "${YELLOW}○ $secret_name skipped (optional)${NC}"
        fi
    else
        gh secret set $secret_name -b "$secret_value" -R $CURRENT_REPO
        echo -e "${GREEN}✓ $secret_name added${NC}"
    fi
}

# Load saved secrets if available
CONFIG_FILE="$HOME/.claude-code-template/secrets.env"
if [ -f "$CONFIG_FILE" ]; then
    echo "Loading saved secrets from ~/.claude-code-template/secrets.env"
    source "$CONFIG_FILE"
    echo -e "${GREEN}✓ Secrets loaded from local config${NC}"
else
    echo -e "${YELLOW}No saved secrets found. Run ./setup-secrets-once.sh to save them for reuse.${NC}"
fi

# Check for existing secrets in environment or ask user
echo "Setting up repository secrets..."

# LINEAR_API_KEY (required)
if [ -z "$LINEAR_API_KEY" ]; then
    echo ""
    echo "LINEAR_API_KEY is required for Linear integration"
    echo "Get it from: https://linear.app/settings/api"
    read -sp "Enter LINEAR_API_KEY: " LINEAR_API_KEY
    echo ""
fi
set_secret "LINEAR_API_KEY" "$LINEAR_API_KEY" "true"

# ANTHROPIC_API_KEY (optional with Claude Code)
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "ANTHROPIC_API_KEY (optional - Claude Code can work without it)"
    read -sp "Enter ANTHROPIC_API_KEY (or press Enter to skip): " ANTHROPIC_API_KEY
    echo ""
fi
set_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY" "false"

# PERPLEXITY_API_KEY (optional)
if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo ""
    echo "PERPLEXITY_API_KEY (optional - for research capabilities)"
    read -sp "Enter PERPLEXITY_API_KEY (or press Enter to skip): " PERPLEXITY_API_KEY
    echo ""
fi
set_secret "PERPLEXITY_API_KEY" "$PERPLEXITY_API_KEY" "false"

# Step 3: Initialize TaskMaster
echo ""
echo "📋 Step 3: Initializing TaskMaster..."
echo "----------------------------------------"

if [ -d ".taskmaster" ]; then
    echo -e "${GREEN}✓ TaskMaster already initialized${NC}"
else
    echo "Initializing TaskMaster..."
    npx task-master-ai init --yes --rules claude || echo -e "${YELLOW}⚠ TaskMaster initialization failed${NC}"
fi

# Step 4: Verify setup
echo ""
echo "✅ Step 4: Verifying Setup..."
echo "----------------------------------------"

# Check app installation
echo -n "Claude Code App: "
if gh api repos/$CURRENT_REPO/installation &>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
fi

# Check secrets
echo -n "Secrets configured: "
SECRET_COUNT=$(gh secret list -R $CURRENT_REPO | wc -l)
echo -e "${GREEN}$SECRET_COUNT secrets${NC}"

# Check Actions enabled
echo -n "GitHub Actions: "
ACTIONS_ENABLED=$(gh api repos/$CURRENT_REPO | jq -r .has_issues)
if [ "$ACTIONS_ENABLED" = "true" ]; then
    echo -e "${GREEN}✓ Enabled${NC}"
else
    echo -e "${YELLOW}⚠ May need to be enabled in Settings${NC}"
fi

# Step 5: Test the setup
echo ""
echo "🧪 Step 5: Testing Setup..."
echo "----------------------------------------"
echo "Creating a test issue with @claude mention..."

# Create test issue
ISSUE_URL=$(gh issue create \
    --title "Test: Claude Code Integration" \
    --body "@claude - Please respond with 'Hello! Claude Code is working!' to confirm the integration is set up correctly." \
    -R $CURRENT_REPO 2>/dev/null) || {
    echo -e "${YELLOW}⚠ Could not create test issue automatically${NC}"
    echo "Please create an issue manually with '@claude' in the body"
    ISSUE_URL=""
}

if [ ! -z "$ISSUE_URL" ]; then
    echo -e "${GREEN}✓ Test issue created: $ISSUE_URL${NC}"
    echo ""
    echo "Check the Actions tab to see if the workflow triggered:"
    echo "https://github.com/$CURRENT_REPO/actions"
fi

# Final summary
echo ""
echo "========================================"
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check if the test issue triggered a workflow"
echo "2. Create a Linear issue and mention @claude"
echo "3. Start building with automated workflows!"
echo ""
echo "If @claude mentions aren't working:"
echo "- Check: https://github.com/$CURRENT_REPO/settings/installations"
echo "- Ensure Claude Code app has access to issues/PRs"
echo "- Check the Actions tab for any workflow runs"
echo ""
echo "Happy coding! 🚀"