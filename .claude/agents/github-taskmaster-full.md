# GitHub-TaskMaster Integration (Full Mode)

Works with full gh CLI access via Bash tool in Claude Code Action.

## What CAN be done:
1. **Generate PRD with TaskMaster** ✅
2. **Update issue descriptions** ✅ (via Bash: gh issue edit)
3. **Create sub-issues for tasks** ✅ (via Bash: gh issue create)
4. **Close sub-issues programmatically** ✅ (via Bash: gh issue close)
5. **Create detailed comments** ✅ (via Bash: gh issue comment)
6. **Execute tasks sequentially** ✅
7. **Create atomic commits** ✅
8. **Reference issues in commits** ✅

## Full Automated Workflow

### Phase 1: PRD Generation and Issue Update
```bash
# Generate PRD with TaskMaster
mcp__taskmaster-ai__parse_prd

# Update issue description with PRD (requires GH_TOKEN)
GH_TOKEN=$GITHUB_TOKEN gh issue edit $ISSUE_NUMBER --body "$(cat <<EOF
$ORIGINAL_BODY

---

## 📋 Generated PRD
$PRD_CONTENT

## 🔄 Task Progress
- Total Tasks: $TASK_COUNT
- Status: Planning
EOF
)"
```

### Phase 2: Create Sub-Issues
```bash
# Create sub-issues for each TaskMaster task
# CRITICAL: Always include @claude mention to trigger automation!
for task in tasks; do
  # Step 1: Create the issue
  SUB_ISSUE_OUTPUT=$(GH_TOKEN=$GITHUB_TOKEN gh issue create \
    --title "[Task #$task.id] $task.title" \
    --body "@claude - Please implement this task. Parent: #$PARENT_ISSUE..." \
    --label "taskmaster-subtask")
  
  # Extract issue number
  SUB_ISSUE_NUMBER=$(echo "$SUB_ISSUE_OUTPUT" | grep -oE '[0-9]+$')
  
  # Step 2: Get the actual issue ID (not just the number)
  SUB_ISSUE_ID=$(GH_TOKEN=$GITHUB_TOKEN gh api \
    "/repos/$OWNER/$REPO/issues/$SUB_ISSUE_NUMBER" --jq '.id')
  
  # Step 3: Link as sub-issue using the actual ID
  GH_TOKEN=$GITHUB_TOKEN gh api -X POST \
    /repos/$OWNER/$REPO/issues/$PARENT_ISSUE/sub_issues \
    --field sub_issue_id=$SUB_ISSUE_ID
done

# Add mapping comment
GH_TOKEN=$GITHUB_TOKEN gh issue comment $PARENT_ISSUE --body "Task mapping table..."
```

### Phase 3: Task Execution
```bash
# Execute tasks sequentially
while has_pending_tasks; do
  # Get next task
  TASK=$(mcp__taskmaster-ai__next_task)
  
  # Update sub-issue status
  GH_TOKEN=$GITHUB_TOKEN gh issue edit $SUB_ISSUE --add-label "in-progress"
  
  # Implement task
  implement_task($TASK)
  
  # Commit with reference
  git commit -m "feat: [Task #$TASK_ID] $TASK_TITLE
  
  Closes #$SUB_ISSUE_NUMBER"
  
  # Close sub-issue
  GH_TOKEN=$GITHUB_TOKEN gh issue close $SUB_ISSUE_NUMBER
done

# Create PR after all tasks complete
GH_TOKEN=$GITHUB_TOKEN gh pr create \
  --title "Implement: $ORIGINAL_ISSUE_TITLE" \
  --body "## Summary
Implements all tasks from #$PARENT_ISSUE

## Tasks Completed
- [x] All TaskMaster tasks completed
- [x] All sub-issues closed
- [x] Code tested and working

Closes #$PARENT_ISSUE" \
  --base main
```

## Best Practice

With full gh CLI access, we can:
1. **Fully automate the GitHub-TaskMaster workflow**
2. **Update issue descriptions programmatically**
3. **Create and manage sub-issues automatically**
4. **Track progress in real-time**
5. **Maintain full traceability**