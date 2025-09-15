#!/bin/bash

# Linear TaskMaster Bot Setup Script
# Helps configure and deploy the bot

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🤖 Linear TaskMaster Bot Setup${NC}"
echo "=============================="
echo ""

# Check for required tools
echo "Checking requirements..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All requirements met${NC}"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Setup environment
if [ ! -f .env ]; then
    echo "Setting up environment..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Created .env file - please add your credentials${NC}"
    echo ""
fi

# Get deployment choice
echo "How would you like to deploy?"
echo "1) Railway (recommended)"
echo "2) VPS with Coolify"
echo "3) Local development"
echo ""
read -p "Choose option (1-3): " deploy_choice

case $deploy_choice in
    1)
        echo ""
        echo -e "${BLUE}Railway Deployment Instructions:${NC}"
        echo "================================"
        echo ""
        echo "1. Create a Railway account at https://railway.app"
        echo "2. Install Railway CLI:"
        echo "   npm install -g @railway/cli"
        echo ""
        echo "3. Login to Railway:"
        echo "   railway login"
        echo ""
        echo "4. Initialize project:"
        echo "   railway init"
        echo ""
        echo "5. Link to this directory:"
        echo "   railway link"
        echo ""
        echo "6. Set environment variables:"
        echo "   railway variables set LINEAR_API_KEY=your_key"
        echo "   railway variables set LINEAR_WEBHOOK_SECRET=your_secret"
        echo ""
        echo "7. Deploy:"
        echo "   railway up"
        echo ""
        echo "Your bot will be available at the URL Railway provides!"
        ;;

    2)
        echo ""
        echo -e "${BLUE}Coolify Deployment Instructions:${NC}"
        echo "================================"
        echo ""
        echo "1. Open your Coolify dashboard"
        echo "2. Create new service"
        echo "3. Choose 'Git Repository'"
        echo "4. Add this repository URL"
        echo "5. Set build pack to 'Node.js'"
        echo "6. Add environment variables:"
        echo "   - LINEAR_API_KEY"
        echo "   - LINEAR_WEBHOOK_SECRET"
        echo "   - GITHUB_TOKEN (optional)"
        echo "   - GITHUB_REPO (optional)"
        echo "7. Deploy!"
        echo ""
        echo "Coolify will handle SSL and domain automatically."
        ;;

    3)
        echo ""
        echo -e "${BLUE}Local Development Setup:${NC}"
        echo "========================"
        echo ""

        # Check .env
        if [ ! -f .env ]; then
            echo -e "${YELLOW}Setting up local environment...${NC}"

            read -p "Enter LINEAR_API_KEY: " LINEAR_KEY
            read -p "Enter LINEAR_WEBHOOK_SECRET (or press enter to generate): " WEBHOOK_SECRET

            if [ -z "$WEBHOOK_SECRET" ]; then
                WEBHOOK_SECRET=$(openssl rand -hex 32)
                echo "Generated webhook secret: $WEBHOOK_SECRET"
            fi

            read -p "Enter GITHUB_TOKEN (optional): " GITHUB_TOKEN
            read -p "Enter GITHUB_REPO (optional, format: owner/repo): " GITHUB_REPO

            cat > .env << EOF
LINEAR_API_KEY=$LINEAR_KEY
LINEAR_WEBHOOK_SECRET=$WEBHOOK_SECRET
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_REPO=$GITHUB_REPO
PORT=3000
EOF

            echo -e "${GREEN}✓ Environment configured${NC}"
        fi

        echo ""
        echo "To start the bot locally:"
        echo "  npm run dev"
        echo ""
        echo "For webhook testing, use ngrok or similar:"
        echo "  ngrok http 3000"
        echo ""
        echo "Then set your Linear webhook to the ngrok URL."
        ;;

    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure Linear webhook at: https://linear.app/settings/api/webhooks"
echo "2. Set webhook URL to: https://your-bot-url/webhook"
echo "3. Select 'Comment created' event"
echo "4. Test with /taskmaster help in any Linear issue"