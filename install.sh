#!/bin/bash

# Install Claude Code Template (CCT) globally

set -e

echo "🚀 Installing Claude Code Template (CCT) Command"
echo "================================================"
echo ""

# Determine install location
if [ -d "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
elif [ -d "$HOME/.local/bin" ]; then
    INSTALL_DIR="$HOME/.local/bin"
else
    INSTALL_DIR="$HOME/bin"
    mkdir -p "$INSTALL_DIR"
fi

# Clone or update template repository
TEMPLATE_DIR="$HOME/.claude-code-template"
if [ -d "$TEMPLATE_DIR" ]; then
    echo "📦 Updating template repository..."
    cd "$TEMPLATE_DIR"
    git pull origin main 2>/dev/null || true
else
    echo "📦 Cloning template repository..."
    git clone https://github.com/yourusername/claude-code-template.git "$TEMPLATE_DIR"
fi

# Create the cct command
cat > "$INSTALL_DIR/cct" << 'EOF'
#!/bin/bash

# Claude Code Template (CCT) - Global Command
# Usage: 
#   cct <project-name>  # Create new project with cloud workflow
#   cct                 # Setup cloud workflow in current directory
#   cct --help          # Show help

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# Template directory
TEMPLATE_DIR="$HOME/.claude-code-template"

# Help function
show_help() {
    echo -e "${BOLD}Claude Code Template (CCT) - Cloud Workflow Setup${NC}"
    echo ""
    echo "Usage:"
    echo "  cct <project-name>    Create new project from template"
    echo "  cct                   Setup cloud workflow in current directory"
    echo "  cct --update          Update CCT to latest version"
    echo "  cct --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  cct my-new-app        Create 'my-new-app' with full automation"
    echo "  cd existing-app && cct  Add cloud workflow to existing project"
    echo ""
    echo "Features:"
    echo "  • One-command setup for Linear + GitHub integration"
    echo "  • Automatic TaskMaster initialization"
    echo "  • Cloud workflow with webhook support"
    echo "  • No local machine needed after setup"
    echo ""
    echo "Learn more: https://github.com/yourusername/claude-code-template"
}

# Update function
update_cct() {
    echo -e "${BLUE}🔄 Updating Claude Code Template...${NC}"
    cd "$TEMPLATE_DIR"
    git pull origin main
    echo -e "${GREEN}✅ Updated to latest version!${NC}"
    exit 0
}

# Check for flags
case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    --update|-u)
        update_cct
        ;;
esac

# Main logic
if [ -z "$1" ]; then
    # No project name - setup current directory
    if [ ! -d ".git" ]; then
        echo -e "${RED}❌ Error: Not in a git repository${NC}"
        echo ""
        echo "Usage:"
        echo "  cct <project-name>  # Create new project"
        echo "  cct                 # Setup current directory (must be git repo)"
        exit 1
    fi
    
    echo -e "${BLUE}🔧 Setting up cloud workflow in current directory...${NC}"
    
    # Copy necessary files from template
    cp -r "$TEMPLATE_DIR/.github" . 2>/dev/null || true
    cp "$TEMPLATE_DIR/setup-cloud-workflow.sh" . 2>/dev/null || true
    chmod +x setup-cloud-workflow.sh
    
    # Run setup
    ./setup-cloud-workflow.sh
    
else
    # Project name provided - create new project
    PROJECT_NAME="$1"
    
    echo -e "${BLUE}🚀 Creating new project: ${BOLD}$PROJECT_NAME${NC}"
    echo ""
    
    # Check if directory exists
    if [ -d "$PROJECT_NAME" ]; then
        echo -e "${RED}❌ Error: Directory '$PROJECT_NAME' already exists${NC}"
        exit 1
    fi
    
    # Create project from template
    echo "📦 Creating repository..."
    gh repo create "$PROJECT_NAME" \
        --template="yourusername/claude-code-template" \
        --private \
        --clone \
        2>/dev/null || {
            # Fallback to manual clone if template doesn't exist
            echo "📦 Using local template..."
            cp -r "$TEMPLATE_DIR" "$PROJECT_NAME"
            cd "$PROJECT_NAME"
            rm -rf .git
            git init
            gh repo create "$PROJECT_NAME" --private --source=.
        }
    
    # Enter directory
    cd "$PROJECT_NAME"
    
    # Run setup
    echo -e "${BLUE}🔧 Running cloud workflow setup...${NC}"
    if [ -f "setup-cloud-workflow.sh" ]; then
        chmod +x setup-cloud-workflow.sh
        ./setup-cloud-workflow.sh
    else
        # Copy from template if missing
        cp "$TEMPLATE_DIR/setup-cloud-workflow.sh" .
        chmod +x setup-cloud-workflow.sh
        ./setup-cloud-workflow.sh
    fi
    
    echo ""
    echo -e "${GREEN}✅ Project created successfully!${NC}"
    echo -e "${YELLOW}📁 Location: $(pwd)${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure Linear webhook (see instructions above)"
    echo "2. Create a Linear issue with @claude mention"
    echo "3. Watch the automation magic! ✨"
fi
EOF

# Make executable
chmod +x "$INSTALL_DIR/cct"

# Add to PATH if needed
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "📝 Adding $INSTALL_DIR to PATH..."
    
    # Detect shell
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    else
        SHELL_RC="$HOME/.profile"
    fi
    
    # Add to PATH
    echo "" >> "$SHELL_RC"
    echo "# Claude Code Template (CCT)" >> "$SHELL_RC"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_RC"
    
    echo "✅ Added to $SHELL_RC"
    echo ""
    echo "⚠️  Run this to update current session:"
    echo "   source $SHELL_RC"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "🎯 Quick Start:"
echo "   cct my-new-project   # Create new project"
echo "   cct --help           # Show all options"
echo ""
echo "📚 Documentation:"
echo "   https://github.com/yourusername/claude-code-template"