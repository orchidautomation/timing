# Custom Bot Identity for GitHub Comments

When using the default GitHub Actions workflow, all comments appear as "github-actions bot". This guide explains how to customize the bot identity so comments appear from a custom account.

## Why Change the Bot Identity?

- **Branding**: Have comments appear from "@YourCompany-Claude" or "@YourProject-AI"
- **Clarity**: Users immediately know responses are from your AI assistant
- **Personalization**: Custom avatar and profile for your bot

## Option 1: Dedicated Bot Account (Recommended)

This is the easiest and most reliable method.

### Step 1: Create a Bot Account

1. Sign out of GitHub or use incognito mode
2. Create a new GitHub account at https://github.com/signup
   - Username: Something like `orchid-claude`, `yourcompany-ai`, or `claude-assistant`
   - Email: Use a dedicated email or alias (e.g., `claude-bot@yourcompany.com`)
   - Set a strong password

3. Customize the bot profile:
   - Upload a custom avatar (maybe a robot icon or your company logo)
   - Set the display name (e.g., "Claude AI Assistant")
   - Add a bio: "AI-powered assistant for automated development tasks"
   - Set the location to "The Cloud ☁️" for fun

### Step 2: Generate Personal Access Token (PAT)

1. Log in to your bot account
2. Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
3. Click "Generate new token (classic)"
4. Give it a descriptive note: "Claude Code Automation"
5. Set expiration (recommendation: 90 days, then rotate)
6. Select scopes:
   ```
   ✅ repo (Full control of private repositories)
      ✅ repo:status
      ✅ repo_deployment
      ✅ public_repo
      ✅ repo:invite
      ✅ security_events
   ✅ workflow (Update GitHub Action workflows)
   ✅ write:discussion (Write discussion)
      ✅ read:discussion
   ```
7. Click "Generate token"
8. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 3: Add Token to Repository Secrets

For each repository where you want the custom bot:

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CLAUDE_BOT_TOKEN`
5. Value: Paste the PAT you generated
6. Click "Add secret"

### Step 4: Update Your Workflow

Modify `.github/workflows/claude-code.yml` to use the bot token:

```yaml
# At the top of the workflow, after the check-claude-mention job
env:
  # Use CLAUDE_BOT_TOKEN if available, otherwise fall back to GITHUB_TOKEN
  GH_TOKEN: ${{ secrets.CLAUDE_BOT_TOKEN || secrets.GITHUB_TOKEN }}
```

Then update all `gh` commands to use this token:

```yaml
# Change from:
GH_TOKEN=$GITHUB_TOKEN gh issue comment ...

# To:
GH_TOKEN=${{ secrets.CLAUDE_BOT_TOKEN || secrets.GITHUB_TOKEN }} gh issue comment ...
```

### Step 5: Invite Bot to Private Repositories

If your repositories are private:

1. Go to repository Settings → Manage access
2. Click "Invite a collaborator"
3. Enter your bot's username
4. Grant appropriate permissions (usually "Write" for full functionality)

## Option 2: GitHub App (Advanced)

For organizations wanting more control and features.

### Benefits:
- Fine-grained permissions
- Installation across multiple repos at once
- Webhook events
- Higher rate limits

### Steps:

1. **Create GitHub App**:
   - Go to Settings → Developer settings → GitHub Apps
   - Click "New GitHub App"
   - Name: "Claude AI Assistant"
   - Homepage URL: Your website
   - Webhook: Can leave unchecked initially
   - Permissions:
     - Issues: Read & Write
     - Pull requests: Read & Write
     - Contents: Read & Write
     - Actions: Read
   - Where can this GitHub App be installed: "Only on this account"

2. **Generate Private Key**:
   - After creation, scroll down to "Private keys"
   - Click "Generate a private key"
   - Save the `.pem` file securely

3. **Install the App**:
   - Go to the app's page
   - Click "Install App"
   - Select repositories

4. **Update Workflow to Use App Token**:
   ```yaml
   - name: Generate App Token
     id: generate-token
     uses: tibdex/github-app-token@v1
     with:
       app_id: ${{ secrets.APP_ID }}
       private_key: ${{ secrets.APP_PRIVATE_KEY }}
   
   - name: Use App Token
     env:
       GH_TOKEN: ${{ steps.generate-token.outputs.token }}
     run: |
       gh issue comment ...
   ```

## Option 3: Enhanced Default Bot (Simplest)

Keep using github-actions bot but make it clear responses are from Claude:

```yaml
# In your workflow, wrap all comments with a signature
gh issue comment ${{ github.event.issue.number }} --body "$(cat << 'EOF'
🤖 **Claude AI Assistant**
━━━━━━━━━━━━━━━━━━━━━

[Your actual response here]

━━━━━━━━━━━━━━━━━━━━━
*Powered by Claude AI | [View Workflow](https://github.com/${{ github.repository }}/actions)*
EOF
)"
```

## Testing Your Setup

1. Create a test issue mentioning @claude
2. Check that the comment appears from your custom bot account
3. Verify the bot has proper permissions to:
   - Comment on issues
   - Create pull requests
   - Push to branches

## Security Considerations

- **Token Rotation**: Rotate PATs every 90 days
- **Minimal Permissions**: Only grant necessary scopes
- **Secret Storage**: Never commit tokens to code
- **Audit Logs**: Monitor bot account activity
- **2FA**: Enable two-factor authentication on bot account

## Troubleshooting

### Bot comments still show as "github-actions"
- Verify `CLAUDE_BOT_TOKEN` secret is set correctly
- Check workflow is using the custom token
- Ensure bot account has repository access

### Permission denied errors
- Bot needs "Write" access to the repository
- PAT needs correct scopes (especially `repo` and `workflow`)
- For org repos, check org settings allow bot accounts

### Rate limiting
- PATs have lower rate limits than GitHub Apps
- Consider GitHub App for high-volume usage
- Implement rate limit handling in workflow

## Multiple Environments

For different bots in different environments:

```yaml
# Use different tokens based on environment
env:
  GH_TOKEN: ${{
    github.event_name == 'pull_request' && secrets.PR_BOT_TOKEN ||
    github.ref == 'refs/heads/main' && secrets.PROD_BOT_TOKEN ||
    secrets.CLAUDE_BOT_TOKEN ||
    secrets.GITHUB_TOKEN
  }}
```

## Example Bot Accounts

Some examples of good bot usernames:
- `@acme-claude` (company prefix)
- `@claude-assistant` (function-based)
- `@orchid-ai` (brand-based)
- `@dev-automation` (generic purpose)

## Next Steps

1. Create your bot account
2. Generate and save the PAT
3. Add to one test repository first
4. Once working, roll out to other repositories
5. Document your bot setup for your team

---

*Note: This setup is optional. The default github-actions bot works fine, but custom bots provide better branding and user experience.*