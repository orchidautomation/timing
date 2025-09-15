#!/bin/bash

# Test script for GitHub sub-issues creation
# This demonstrates the three-step process for creating proper sub-issues

set -e

echo "🧪 Testing GitHub Sub-Issues Creation"
echo "====================================="

# Check if GH_TOKEN or GITHUB_TOKEN is set
if [ -z "$GH_TOKEN" ] && [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GH_TOKEN or GITHUB_TOKEN must be set"
    exit 1
fi

# Use GH_TOKEN if set, otherwise use GITHUB_TOKEN
TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"

# Get owner and repo from current git repository
OWNER=$(gh repo view --json owner -q .owner.login)
REPO=$(gh repo view --json name -q .name)

echo "Repository: $OWNER/$REPO"
echo ""

# Check if parent issue number is provided
if [ -z "$1" ]; then
    echo "Creating a parent test issue..."
    PARENT_OUTPUT=$(GH_TOKEN=$TOKEN gh issue create \
        --title "Test Parent Issue for Sub-Issues" \
        --body "This is a test parent issue to demonstrate sub-issue creation.

@claude - This parent issue will have sub-issues attached.")
    
    PARENT_ISSUE=$(echo "$PARENT_OUTPUT" | grep -oE '[0-9]+$')
    echo "✅ Created parent issue #$PARENT_ISSUE"
else
    PARENT_ISSUE="$1"
    echo "Using existing parent issue #$PARENT_ISSUE"
fi

echo ""
echo "Creating sub-issues..."
echo "----------------------"

# Create multiple test sub-issues
for i in 1 2 3; do
    echo ""
    echo "Creating sub-issue $i..."
    
    # Step 1: Create the issue
    SUB_ISSUE_OUTPUT=$(GH_TOKEN=$TOKEN gh issue create \
        --title "[Task #$i] Test Sub-Issue $i" \
        --body "@claude - This is test sub-issue $i

## Parent Issue: #$PARENT_ISSUE

### Task Details
This is a test sub-issue created to verify the sub-issue linking functionality.

### Metadata
- Task ID: $i
- Parent Issue: #$PARENT_ISSUE
- Status: pending

---
*This sub-issue was auto-generated for testing*" \
        --label "taskmaster-subtask")
    
    # Step 2: Extract issue number
    SUB_ISSUE_NUMBER=$(echo "$SUB_ISSUE_OUTPUT" | grep -oE '[0-9]+$')
    echo "  ✅ Created issue #$SUB_ISSUE_NUMBER"
    
    # Step 3: Get the actual issue ID (not just the number)
    SUB_ISSUE_ID=$(GH_TOKEN=$TOKEN gh api \
        "/repos/$OWNER/$REPO/issues/$SUB_ISSUE_NUMBER" --jq '.id')
    echo "  📝 Issue ID: $SUB_ISSUE_ID"
    
    # Step 4: Link as sub-issue to parent using the actual ID
    echo "  🔗 Linking as sub-issue..."
    if GH_TOKEN=$TOKEN gh api -X POST \
        "/repos/$OWNER/$REPO/issues/$PARENT_ISSUE/sub_issues" \
        --field sub_issue_id="$SUB_ISSUE_ID" 2>/dev/null; then
        echo "  ✅ Successfully linked #$SUB_ISSUE_NUMBER as sub-issue of #$PARENT_ISSUE"
    else
        echo "  ⚠️  Could not link as sub-issue (API might not be available)"
    fi
done

echo ""
echo "====================================="
echo "✅ Test completed!"
echo ""
echo "Check the parent issue to see sub-issues:"
echo "https://github.com/$OWNER/$REPO/issues/$PARENT_ISSUE"
echo ""
echo "Note: If sub-issue linking failed, it might be because:"
echo "1. The sub-issues API is not yet available in your GitHub instance"
echo "2. You need different permissions"
echo "3. The feature is still in preview"
echo ""
echo "Even without API linking, the issues are still connected via references."