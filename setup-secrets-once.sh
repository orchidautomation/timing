#!/bin/bash

# One-time setup script to save your API keys locally
# These can then be used across all your repos

set -e

echo "🔐 Claude Code Template - One-Time Secret Setup"
echo "==============================================="
echo ""
echo "This script saves your API keys locally so you can reuse them"
echo "across all repos created from this template."
echo ""

CONFIG_DIR="$HOME/.claude-code-template"
CONFIG_FILE="$CONFIG_DIR/secrets.env"

# Create config directory
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

# Function to get and save secret
save_secret() {
    local secret_name=$1
    local description=$2
    local is_required=$3
    
    echo ""
    echo "$description"
    
    if [ "$is_required" = "true" ]; then
        read -sp "Enter $secret_name (required): " value
    else
        read -sp "Enter $secret_name (optional, press Enter to skip): " value
    fi
    echo ""
    
    if [ ! -z "$value" ]; then
        echo "export $secret_name='$value'" >> "$CONFIG_FILE"
        echo "✓ $secret_name saved"
    elif [ "$is_required" = "true" ]; then
        echo "⚠️  Warning: $secret_name is required for full functionality"
    fi
}

# Clear existing config
> "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

echo "Please enter your API keys (they'll be saved securely in ~/.claude-code-template/)"

save_secret "LINEAR_API_KEY" "Linear API Key (get from https://linear.app/settings/api)" "true"
save_secret "ANTHROPIC_API_KEY" "Anthropic API Key (optional with Claude Code backend)" "false"
save_secret "PERPLEXITY_API_KEY" "Perplexity API Key (optional, for research)" "false"

echo ""
echo "✅ Secrets saved to: $CONFIG_FILE"
echo ""
echo "These will be automatically loaded when you run setup-new-repo.sh"
echo ""
echo "To update these later, run this script again."