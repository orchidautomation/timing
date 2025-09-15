#!/bin/bash

# Claude Code Template Setup Script
# This script automates the initialization of a new project with Claude Code integrations

set -e

echo "🚀 Claude Code Template Setup"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running in a git repository
check_git() {
    if [ -d .git ]; then
        print_status "Git repository detected"
    else
        echo "Initializing git repository..."
        git init
        print_status "Git repository initialized"
    fi
}

# Install Claude GitHub App
install_claude_app() {
    echo ""
    echo "📱 Installing Claude GitHub App..."
    
    if command -v gh &> /dev/null; then
        print_status "GitHub CLI detected"
        
        # Check if authenticated
        if gh auth status &> /dev/null; then
            print_status "GitHub CLI authenticated"
        else
            print_warning "GitHub CLI not authenticated"
            echo "Please authenticate with: gh auth login"
            read -p "Press enter after authentication to continue..."
        fi
        
        # Install Claude extension if not present
        if ! gh extension list | grep -q "claude"; then
            echo "Installing Claude GitHub extension..."
            gh extension install anthropics/claude-code-extension 2>/dev/null || true
        fi
        
        # Install the app
        echo "Installing Claude GitHub App to repository..."
        gh claude install-app 2>/dev/null || print_warning "Could not auto-install app. Please install manually."
        
    else
        print_warning "GitHub CLI not found. Please install manually:"
        echo "  1. Visit: https://github.com/apps/claude-code"
        echo "  2. Install the app to your repository"
        read -p "Press enter after installation to continue..."
    fi
}

# Set up GitHub secrets
setup_secrets() {
    echo ""
    echo "🔐 Setting up GitHub Secrets..."
    
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        # Anthropic API Key (optional for Claude Code)
        if [ -z "$ANTHROPIC_API_KEY" ]; then
            print_warning "ANTHROPIC_API_KEY not found in environment"
            echo "Note: Not required if using Claude Code backend"
            read -p "Enter Anthropic API key (or press enter to skip): " api_key
            if [ ! -z "$api_key" ]; then
                gh secret set ANTHROPIC_API_KEY -b "$api_key"
                print_status "ANTHROPIC_API_KEY secret added"
            fi
        else
            gh secret set ANTHROPIC_API_KEY -b "$ANTHROPIC_API_KEY"
            print_status "ANTHROPIC_API_KEY secret added from environment"
        fi
        
        # Linear API Key
        if [ -z "$LINEAR_API_KEY" ]; then
            read -p "Enter Linear API key: " linear_key
            if [ ! -z "$linear_key" ]; then
                gh secret set LINEAR_API_KEY -b "$linear_key"
                print_status "LINEAR_API_KEY secret added"
            fi
        else
            gh secret set LINEAR_API_KEY -b "$LINEAR_API_KEY"
            print_status "LINEAR_API_KEY secret added from environment"
        fi
        
        # Perplexity API Key (optional)
        read -p "Enter Perplexity API key (optional, press enter to skip): " perplexity_key
        if [ ! -z "$perplexity_key" ]; then
            gh secret set PERPLEXITY_API_KEY -b "$perplexity_key"
            print_status "PERPLEXITY_API_KEY secret added"
        fi
        
    else
        print_warning "Cannot set secrets automatically. Please add manually in GitHub settings:"
        echo "  - ANTHROPIC_API_KEY (optional with Claude Code)"
        echo "  - LINEAR_API_KEY"
        echo "  - PERPLEXITY_API_KEY (optional)"
    fi
}

# Initialize TaskMaster
init_taskmaster() {
    echo ""
    echo "📋 Initializing TaskMaster..."
    
    if command -v task-master &> /dev/null; then
        print_status "TaskMaster CLI found"
    else
        echo "Installing TaskMaster CLI..."
        npm install -g task-master-ai
        print_status "TaskMaster CLI installed"
    fi
    
    # Initialize TaskMaster
    echo "Initializing TaskMaster in project..."
    npx task-master init --yes --rules claude || print_warning "TaskMaster already initialized"
    
    print_status "TaskMaster initialized"
}

# Set up MCP servers
setup_mcp() {
    echo ""
    echo "🔧 Setting up MCP Servers..."
    
    # Check if Claude Code is available
    if command -v claude &> /dev/null; then
        print_status "Claude Code CLI detected"
        
        # Add TaskMaster MCP (project level)
        echo "Adding TaskMaster MCP server..."
        claude mcp add taskmaster-ai --scope project || true
        
        # Add GitHub MCP (project level)
        echo "Adding GitHub MCP server..."
        claude mcp add github --scope project || true
        
        # Check for Linear MCP (should be global)
        echo "Checking Linear MCP server..."
        if ! claude mcp list | grep -q "linear"; then
            print_warning "Linear MCP not found globally"
            echo "Please install globally with:"
            echo "  claude mcp add linear --scope user --transport sse https://mcp.linear.app/sse"
        else
            print_status "Linear MCP server found"
        fi
        
    else
        print_warning "Claude Code CLI not found"
        echo "Please install Claude Code and set up MCP servers manually"
    fi
}

# Create project structure
create_structure() {
    echo ""
    echo "📁 Creating project structure..."
    
    # Create directories
    mkdir -p .claude/agents
    mkdir -p .claude/workflows
    mkdir -p .github/workflows
    mkdir -p .taskmaster/docs
    
    print_status "Directory structure created"
    
    # Copy configuration files if in template directory
    if [ -f "CLAUDE.md" ]; then
        cp CLAUDE.md .claude/CLAUDE.md 2>/dev/null || true
        print_status "CLAUDE.md copied"
    fi
    
    if [ -f "mcp-claude.json" ]; then
        cp mcp-claude.json .claude/mcp.json 2>/dev/null || true
        print_status "MCP configuration copied"
    fi
    
    if [ -f "github-actions-workflow.yml" ]; then
        cp github-actions-workflow.yml .github/workflows/claude-code.yml 2>/dev/null || true
        print_status "GitHub Actions workflow copied"
    fi
    
    # Copy agent definitions
    for agent in agent-*.md; do
        if [ -f "$agent" ]; then
            name=$(echo $agent | sed 's/agent-//' | sed 's/.md//')
            cp "$agent" ".claude/agents/${name}.md" 2>/dev/null || true
        fi
    done
    print_status "Agent definitions copied"
    
    # Copy workflow definitions
    for workflow in workflow-*.md; do
        if [ -f "$workflow" ]; then
            name=$(echo $workflow | sed 's/workflow-//' | sed 's/.md//')
            cp "$workflow" ".claude/workflows/${name}.md" 2>/dev/null || true
        fi
    done
    print_status "Workflow definitions copied"
}

# Configure TaskMaster models
configure_models() {
    echo ""
    echo "🤖 Configuring AI Models..."
    
    if command -v task-master &> /dev/null; then
        # Try to use Claude Code backend
        echo "Attempting to configure Claude Code backend..."
        task-master models --set-main claude-code/sonnet 2>/dev/null || {
            print_warning "Claude Code backend not available"
            echo "Falling back to API key configuration..."
            task-master models --set-main claude-3-5-sonnet-latest 2>/dev/null || true
        }
        
        # Set research model if Perplexity is available
        if [ ! -z "$PERPLEXITY_API_KEY" ]; then
            task-master models --set-research perplexity/llama-3.1-sonar-large-128k-online 2>/dev/null || true
            print_status "Research model configured"
        fi
        
        print_status "Models configured"
    fi
}

# Main setup flow
main() {
    echo "Starting setup process..."
    echo ""
    
    # Run setup steps
    check_git
    create_structure
    install_claude_app
    setup_secrets
    init_taskmaster
    setup_mcp
    configure_models
    
    echo ""
    echo "=================================="
    echo -e "${GREEN}✅ Setup Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Create a PRD in .taskmaster/docs/prd.txt"
    echo "2. Link your Linear workspace with GitHub"
    echo "3. Create a Linear issue with @claude mention"
    echo "4. Watch the magic happen! 🎉"
    echo ""
    echo "For more information, see README.md"
}

# Run main function
main