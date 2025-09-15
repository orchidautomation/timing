# Linear Integration Setup Guide

## Two Different Approaches

### 1. For Local Development (Using Linear MCP)
Linear MCP provides OAuth-based authentication perfect for local Claude Code usage:

```bash
# Install Linear MCP globally (one-time setup)
claude mcp add linear --scope user --transport sse https://mcp.linear.app/sse
```

Then authenticate in Claude Code:
```
/mcp
```

This will open a browser for OAuth authentication. Great for local development!

### 2. For GitHub Actions (Using Linear API Key)
Since GitHub Actions runs headless (no browser), you MUST use a Linear API key:

#### Get Your Linear API Key:
1. Go to Linear Settings → API → Personal API keys
2. Create a new key with permissions:
   - `read` - View issues, projects, teams
   - `write` - Create/update issues
   - `admin` - Optional, for full access

#### Add to GitHub Secrets:
```bash
gh secret set LINEAR_API_KEY -b "lin_api_YOUR_KEY_HERE"
```

## Why Two Approaches?

- **Linear MCP**: Uses OAuth 2.1 with browser authentication
  - ✅ Great for local development
  - ✅ No API key needed
  - ❌ Doesn't work in GitHub Actions (no browser)

- **Linear API Key**: Direct API access
  - ✅ Works in GitHub Actions
  - ✅ Never expires (unless revoked)
  - ❌ Requires manual key management

## Configuration Files

### For Local Claude Code (.claude/mcp.json)
```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.linear.app/sse"]
    },
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}"
      }
    }
  }
}
```

### For GitHub Actions (Environment Variables)
The workflow uses these secrets:
- `LINEAR_API_KEY` - Required for Linear API access
- `ANTHROPIC_API_KEY` - For Claude API (optional with Claude Code backend)
- `PERPLEXITY_API_KEY` - Optional, for research
- `GITHUB_TOKEN` - Automatically provided by GitHub

## Testing Your Setup

### Local Testing
1. Open Claude Code
2. Run `/mcp` to authenticate with Linear
3. Test with: `linear list_my_issues`

### GitHub Actions Testing
1. Create a test issue in GitHub
2. Add "@claude test linear connection" in the body
3. Check Actions tab for workflow run

## Troubleshooting

### "Linear MCP not working in GitHub Actions"
This is expected! Use the LINEAR_API_KEY instead.

### "OAuth token expired"
For local development, run `/mcp` again to re-authenticate.

### "Permission denied" errors
Check your Linear API key has the required permissions.

## Alternative: Linear GraphQL API
If you need more control, you can directly use Linear's GraphQL API:
```javascript
const response = await fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LINEAR_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `query { viewer { id email name } }`
  })
});
```