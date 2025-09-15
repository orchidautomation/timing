#!/bin/bash

# Setup Linear Webhook for fully automated cloud workflow
# This enables triggering GitHub Actions directly from Linear

echo "🔄 Setting up Linear Webhook Integration..."

# Get repository info
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    echo "❌ Error: Not in a GitHub repository"
    exit 1
fi

# Create GitHub webhook token if not exists
if ! gh secret list | grep -q "WEBHOOK_SECRET"; then
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    gh secret set WEBHOOK_SECRET -b "$WEBHOOK_SECRET"
    echo "✅ Created WEBHOOK_SECRET"
else
    echo "ℹ️  WEBHOOK_SECRET already exists"
fi

# Generate webhook URL
WEBHOOK_URL="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/dispatches"

echo ""
echo "📋 Linear Webhook Configuration:"
echo "================================"
echo ""
echo "1. Go to Linear Settings → Integrations → Webhooks"
echo "2. Click 'New Webhook'"
echo "3. Configure as follows:"
echo ""
echo "   URL: $WEBHOOK_URL"
echo "   Events to subscribe:"
echo "   - Issue created"
echo "   - Issue updated" 
echo "   - Issue state changed"
echo "   - Comment created"
echo ""
echo "4. Add these headers:"
echo "   Authorization: Bearer YOUR_GITHUB_PAT"
echo "   Accept: application/vnd.github.v3+json"
echo "   Content-Type: application/json"
echo ""
echo "5. Set the payload template to:"
cat << 'EOF'
{
  "event_type": "linear-webhook",
  "client_payload": {
    "action": "{{action}}",
    "data": {
      "id": "{{data.id}}",
      "identifier": "{{data.identifier}}",
      "title": "{{data.title}}",
      "description": "{{data.description}}",
      "state": "{{data.state.name}}",
      "assignee": "{{data.assignee.name}}",
      "team": "{{data.team.key}}"
    }
  }
}
EOF

echo ""
echo "📝 Note: You'll need a GitHub Personal Access Token with 'repo' scope"
echo "   Create one at: https://github.com/settings/tokens"
echo ""
echo "Once configured, creating/updating issues in Linear will automatically"
echo "trigger Claude to implement them in your GitHub repository!"