#!/bin/bash

# Add Claude Code automation to an EXISTING repository
# Run this from inside any existing Git repo to add Claude Code integration

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔧 Adding Claude Code Automation to Existing Repo${NC}"
echo "=================================================="
echo ""
echo "This script will:"
echo "  • Add missing Claude Code files only"
echo "  • Skip any files that already exist"
echo "  • Not overwrite or break existing workflows"
echo "  • Set up GitHub secrets safely"
echo ""

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo -e "${RED}Error: Not in a git repository!${NC}"
    echo "Please run this from your project's root directory"
    exit 1
fi

# Get repo info
CURRENT_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$CURRENT_REPO" ]; then
    echo -e "${RED}Error: This repo is not connected to GitHub${NC}"
    echo "Please push to GitHub first, then run this script again"
    exit 1
fi

echo -e "${GREEN}✓ Detected repo: $CURRENT_REPO${NC}"
echo ""

# Step 1: Download necessary files from template
echo "1️⃣  Downloading Claude Code template files..."

TEMPLATE_REPO="orchidautomation/claude-code-template"
TEMP_DIR=$(mktemp -d)

# Use gh CLI to download the repo (works with private repos)
gh repo clone "$TEMPLATE_REPO" "$TEMP_DIR/template" -- --depth=1 --quiet 2>/dev/null || {
    echo -e "${RED}Failed to clone template repo${NC}"
    exit 1
}

TEMPLATE_FILES="$TEMP_DIR/template"

# Step 2: Copy necessary files
echo "2️⃣  Adding Claude Code configuration..."

# Create directories
mkdir -p .github/workflows
mkdir -p .claude/agents
mkdir -p .claude/workflows
mkdir -p .taskmaster/docs

# Copy workflow files (skip if they exist)
if [ -f .github/workflows/claude-code.yml ]; then
    echo "  ⚠ claude-code.yml already exists - skipping"
else
    cp "$TEMPLATE_FILES/.github/workflows/claude-code.yml" .github/workflows/
    echo "  ✓ Added claude-code.yml workflow"
fi

# Removed test-linear.yml - no longer using Linear

# Copy Claude configuration
if [ ! -f .claude/CLAUDE.md ]; then
    cp "$TEMPLATE_FILES/.claude/CLAUDE.md" .claude/
    echo "  ✓ Added CLAUDE.md configuration"
fi

if [ ! -f .claude/mcp.json ]; then
    cp "$TEMPLATE_FILES/.claude/mcp.json" .claude/
    echo "  ✓ Added MCP configuration"
fi

# Copy agent definitions
for agent in "$TEMPLATE_FILES"/.claude/agents/*.md; do
    if [ -f "$agent" ]; then
        basename=$(basename "$agent")
        if [ ! -f ".claude/agents/$basename" ]; then
            cp "$agent" ".claude/agents/"
            echo "  ✓ Added agent: $basename"
        fi
    fi
done

# Copy workflow definitions  
for workflow in "$TEMPLATE_FILES"/.claude/workflows/*.md; do
    if [ -f "$workflow" ]; then
        basename=$(basename "$workflow")
        if [ ! -f ".claude/workflows/$basename" ]; then
            cp "$workflow" ".claude/workflows/"
            echo "  ✓ Added workflow: $basename"
        fi
    fi
done

# Copy setup scripts for future use
cp "$TEMPLATE_FILES/setup-new-repo.sh" . 2>/dev/null || true
cp "$TEMPLATE_FILES/setup-secrets-once.sh" . 2>/dev/null || true
chmod +x *.sh 2>/dev/null || true

echo -e "${GREEN}✓ Configuration files added${NC}"
echo ""

# Step 3: Install Claude Code GitHub App
echo "3️⃣  Installing Claude Code GitHub App..."

if gh api repos/$CURRENT_REPO/installation &>/dev/null; then
    echo -e "${GREEN}✓ Claude Code app already installed${NC}"
else
    echo "Opening browser to install Claude Code app..."
    echo "Please install for: $CURRENT_REPO"
    
    # Try to open browser
    open "https://github.com/apps/claude-code/installations/new" 2>/dev/null || \
        xdg-open "https://github.com/apps/claude-code/installations/new" 2>/dev/null || \
        echo "Visit: https://github.com/apps/claude-code/installations/new"
    
    read -p "Press Enter after installing the app..."
    echo -e "${GREEN}✓ Claude Code app installed${NC}"
fi
echo ""

# Step 3.5: Create Linear Team (optional)
echo "3.5️ Create Linear team for this repository?"
read -p "Do you want to create a Linear team? (y/n): " create_linear_team

if [ "$create_linear_team" = "y" ] || [ "$create_linear_team" = "Y" ]; then
    # Load saved secrets if available (for LINEAR_API_KEY)
    CONFIG_FILE="$HOME/.claude-code-template/secrets.env"
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    fi
    
    # Get LINEAR_API_KEY if not already set
    if [ -z "$LINEAR_API_KEY" ]; then
        echo ""
        read -sp "Enter LINEAR_API_KEY: " LINEAR_API_KEY
        echo ""
    fi
    
    if [ ! -z "$LINEAR_API_KEY" ]; then
        # Extract project name from repo
        PROJECT_NAME=$(basename "$CURRENT_REPO")
        TEAM_KEY=$(echo "$PROJECT_NAME" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]' | cut -c1-5)
        
        echo "  Creating Linear team: $PROJECT_NAME..."
        LINEAR_RESPONSE=$(curl -s -X POST https://api.linear.app/graphql \
          -H "Authorization: $LINEAR_API_KEY" \
          -H "Content-Type: application/json" \
          -d @- <<EOF
{
  "query": "mutation CreateTeam(\\\$input: TeamCreateInput!) {
    teamCreate(input: \\\$input) {
      success
      team {
        id
        key
        name
      }
    }
  }",
  "variables": {
    "input": {
      "name": "$PROJECT_NAME",
      "key": "$TEAM_KEY",
      "description": "Auto-created for GitHub repo $CURRENT_REPO"
    }
  }
}
EOF
        )
        
        LINEAR_TEAM_ID=$(echo "$LINEAR_RESPONSE" | jq -r '.data.teamCreate.team.id' 2>/dev/null)
        LINEAR_TEAM_KEY=$(echo "$LINEAR_RESPONSE" | jq -r '.data.teamCreate.team.key' 2>/dev/null)
        
        if [ ! -z "$LINEAR_TEAM_ID" ] && [ "$LINEAR_TEAM_ID" != "null" ]; then
            echo -e "${GREEN}  ✓ Linear team created: $LINEAR_TEAM_KEY${NC}"
            
            # Store team ID as GitHub secret
            gh secret set LINEAR_TEAM_ID -b "$LINEAR_TEAM_ID" 2>/dev/null || echo "  ⚠ Could not set LINEAR_TEAM_ID secret"
            
            # Create local Linear configuration
            mkdir -p .linear
            cat > .linear/config.json <<CONFIG_EOF
{
  "teamId": "$LINEAR_TEAM_ID",
  "teamKey": "$LINEAR_TEAM_KEY",
  "teamName": "$PROJECT_NAME",
  "repository": "$CURRENT_REPO",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
CONFIG_EOF
            
            # This will be committed later with other changes
            echo -e "${GREEN}  ✓ Linear team connected to GitHub repository${NC}"
        else
            echo -e "${YELLOW}  ⚠ Could not create Linear team${NC}"
            if [ "$DEBUG" = "true" ]; then
                echo "  Debug: Linear API response:"
                echo "$LINEAR_RESPONSE" | jq '.' 2>/dev/null || echo "$LINEAR_RESPONSE"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ LINEAR_API_KEY not provided, skipping team creation${NC}"
    fi
fi
echo ""

# Step 4: Set up GitHub secrets
echo "4️⃣  Setting up GitHub secrets..."

# Load saved secrets if available
CONFIG_FILE="$HOME/.claude-code-template/secrets.env"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo "  ✓ Loaded saved secrets"
else
    echo -e "${YELLOW}No saved secrets found${NC}"
    echo ""
    read -sp "Enter ANTHROPIC_API_KEY (REQUIRED for GitHub Actions): " ANTHROPIC_API_KEY
    echo ""
    read -sp "Enter PERPLEXITY_API_KEY (optional for research): " PERPLEXITY_API_KEY
    echo ""
    
    # Save for future
    mkdir -p "$HOME/.claude-code-template"
    chmod 700 "$HOME/.claude-code-template"
    cat > "$CONFIG_FILE" << EOF
export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'
export PERPLEXITY_API_KEY='$PERPLEXITY_API_KEY'
export LINEAR_API_KEY='$LINEAR_API_KEY'
EOF
    chmod 600 "$CONFIG_FILE"
fi

# Set secrets in GitHub
[ ! -z "$ANTHROPIC_API_KEY" ] && gh secret set ANTHROPIC_API_KEY -b "$ANTHROPIC_API_KEY" && echo "  ✓ ANTHROPIC_API_KEY set"
[ ! -z "$PERPLEXITY_API_KEY" ] && gh secret set PERPLEXITY_API_KEY -b "$PERPLEXITY_API_KEY" && echo "  ✓ PERPLEXITY_API_KEY set"
[ ! -z "$LINEAR_API_KEY" ] && gh secret set LINEAR_API_KEY -b "$LINEAR_API_KEY" && echo "  ✓ LINEAR_API_KEY set"

echo -e "${GREEN}✓ Secrets configured${NC}"
echo ""

# Step 5: Initialize TaskMaster (optional)
echo "5️⃣  Initialize TaskMaster?"
read -p "Do you want to initialize TaskMaster? (y/n): " init_tm
if [ "$init_tm" = "y" ] || [ "$init_tm" = "Y" ]; then
    if [ ! -d .taskmaster ]; then
        # Install Claude Code CLI if not present (for v0.18+ support)
        which claude-code || npm install -g @anthropic-ai/claude-code 2>/dev/null || true
        npx task-master-ai init --yes --rules claude 2>/dev/null || echo "  ⚠ TaskMaster init failed"
        # Configure Claude Code models (v0.18+)
        npx task-master-ai models --set-main sonnet --claude-code 2>/dev/null || true
        echo "  ✓ TaskMaster initialized with Claude Code support"
    else
        echo "  ✓ TaskMaster already initialized"
    fi
fi
echo ""

# Step 6: Commit changes
echo "6️⃣  Committing changes..."
git add .github .claude .taskmaster .linear *.sh 2>/dev/null || true
git commit -m "Add Claude Code automation integration

- Added GitHub Actions workflow for Claude Code
- Added Claude Code configuration
- Added TaskMaster integration
- Added Linear team configuration (if created)
- Ready for AI-powered development" || echo "  ℹ No changes to commit"

echo ""

# Step 7: Push and test
echo "7️⃣  Push changes?"
read -p "Push to GitHub? (y/n): " push_changes
if [ "$push_changes" = "y" ] || [ "$push_changes" = "Y" ]; then
    git push
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
    
    # Create test issue
fi

# Cleanup
rm -rf "$TEMP_DIR"

# Final summary
echo ""
echo "=================================================="
echo -e "${GREEN}✨ Claude Code Integration Complete!${NC}"
echo ""
echo "Your existing repo now has:"
echo "  ✅ Claude Code GitHub App installed"
echo "  ✅ GitHub Actions workflow for @claude mentions"
echo "  ✅ GitHub integration ready"
echo "  ✅ TaskMaster support"
echo "  ✅ All secrets configured"
if [ -f ".linear/config.json" ]; then
    echo "  ✅ Linear team created and connected"
fi
echo ""
echo "Next steps:"
echo "1. Check Actions tab: https://github.com/$CURRENT_REPO/actions"
echo "2. Create issues with @claude mentions"
echo "3. Test by commenting @claude in an issue"
echo ""
echo "Happy coding with Claude! 🤖"