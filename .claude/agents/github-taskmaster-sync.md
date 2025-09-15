# GitHub-TaskMaster Sync Agent

Orchestrates TaskMaster workflow with GitHub Issues as the primary tracking system, enabling optional Linear sync.

## Core Workflow

### Phase 1: PRD Generation
When @claude is mentioned with TaskMaster/PRD request:

1. **Parse the GitHub Issue**
```javascript
const issue = {
  number: ${{ github.event.issue.number }},
  title: ${{ github.event.issue.title }},
  body: ${{ github.event.issue.body }}
}
```

2. **Generate PRD with TaskMaster**
```
mcp__taskmaster-ai__parse_prd
  input: issue.body
  numTasks: auto
```

### Phase 2: Update GitHub Issue with PRD

3. **Update Issue Description**
```bash
# Append PRD to issue body (requires GH_TOKEN authentication)
GH_TOKEN=$GITHUB_TOKEN gh issue edit $ISSUE_NUMBER --body "$(cat <<EOF
$ORIGINAL_BODY

---

## 📋 Generated PRD

$PRD_CONTENT

## 🔄 Task Progress
- Total Tasks: $TASK_COUNT
- Status: Planning
- TaskMaster ID: $TASKMASTER_PROJECT_ID

## 📊 Subtasks
See comments below for subtask issues.
EOF
)"
```

### Phase 3: Create GitHub Sub-Issues

4. **Create Sub-Issue for Each Task**
```bash
for task in tasks; do
  # Step 1: Create the issue
  SUB_ISSUE_OUTPUT=$(GH_TOKEN=$GITHUB_TOKEN gh issue create \
    --title "[Task #$task.id] $task.title" \
    --body "@claude - Please implement this task:

## Parent Issue: #$PARENT_ISSUE

### Task Details
$task.description

### Implementation Notes
$task.details

### Dependencies
- Depends on: $task.dependencies

### Metadata
- TaskMaster Task ID: $task.id
- Parent Issue: #$PARENT_ISSUE
- Status: pending

---
*This sub-issue was auto-generated from TaskMaster*" \
    --label "taskmaster-subtask,auto-generated")
  
  # Extract issue number from output
  SUB_ISSUE_NUMBER=$(echo "$SUB_ISSUE_OUTPUT" | grep -oE '[0-9]+$')
  
  # Step 2: Get the actual issue ID (not just the number)
  SUB_ISSUE_ID=$(GH_TOKEN=$GITHUB_TOKEN gh api \
    "/repos/$OWNER/$REPO/issues/$SUB_ISSUE_NUMBER" --jq '.id')
  
  # Step 3: Link as sub-issue to parent using the actual ID
  GH_TOKEN=$GITHUB_TOKEN gh api -X POST \
    /repos/$OWNER/$REPO/issues/$PARENT_ISSUE/sub_issues \
    --field sub_issue_id=$SUB_ISSUE_ID
    
  # Store mapping
  echo "$task.id:$SUB_ISSUE_NUMBER" >> task_mappings.txt
done
```

5. **Add Mapping Comment to Parent**
```bash
GH_TOKEN=$GITHUB_TOKEN gh issue comment $PARENT_ISSUE --body "## 📝 TaskMaster Subtasks Created

| Task ID | Title | GitHub Issue | Status |
|---------|-------|--------------|--------|
| 1 | Setup project | #23 | ⏳ Pending |
| 2 | Create models | #24 | ⏳ Pending |
| 3 | Add API | #25 | ⏳ Pending |

Track progress in each sub-issue or use TaskMaster commands."
```

### Phase 4: Task Execution

6. **Execute Tasks Sequentially**
```bash
while has_pending_tasks; do
  # Get next task
  TASK=$(mcp__taskmaster-ai__next_task)
  
  # Update GitHub sub-issue
  GH_TOKEN=$GITHUB_TOKEN gh issue edit $SUB_ISSUE_NUMBER \
    --add-label "in-progress" \
    --remove-label "pending"
  
  GH_TOKEN=$GITHUB_TOKEN gh issue comment $SUB_ISSUE_NUMBER \
    --body "🚀 Starting implementation..."
  
  # Implement task
  implement_task($TASK)
  
  # Commit with reference
  git commit -m "feat: [Task #$TASK_ID] $TASK_TITLE

Implements TaskMaster task #$TASK_ID
Closes #$SUB_ISSUE_NUMBER
Parent: #$PARENT_ISSUE"
  
  # Update TaskMaster
  mcp__taskmaster-ai__set_task_status \
    --id $TASK_ID \
    --status "done"
  
  # Close GitHub sub-issue
  GH_TOKEN=$GITHUB_TOKEN gh issue close $SUB_ISSUE_NUMBER \
    --comment "✅ Task completed in commit $COMMIT_SHA"
  
  # Update parent progress
  update_parent_progress()
done
```

### Phase 5: Completion

7. **Create Pull Request**
```bash
GH_TOKEN=$GITHUB_TOKEN gh pr create \
  --title "$ISSUE_TITLE" \
  --body "## Summary
Implements all tasks from #$PARENT_ISSUE

## Tasks Completed
$TASK_LIST

## Testing
- [ ] All tests pass
- [ ] Manual testing complete

Closes #$PARENT_ISSUE" \
  --assignee "@me"
```

## GitHub Issue Structure

### Parent Issue (After PRD)
```markdown
Original request text...

---

## 📋 Generated PRD
[Full PRD content]

## 🔄 Task Progress
- Total Tasks: 8
- Completed: 3/8 (37.5%)
- Status: In Progress
- TaskMaster ID: proj_123

## 📊 Subtasks
See comments for linked sub-issues
```

### Sub-Issue Template
```markdown
## Parent Issue: #15

### Task Details
Implement user authentication middleware

### Implementation Notes
- Use JWT tokens
- Include refresh token logic
- Add rate limiting

### Dependencies
- Depends on: Task #1, Task #2

### Metadata
- TaskMaster Task ID: 3
- Parent Issue: #15
- Status: pending
```

## Synchronization Points

### GitHub → TaskMaster
- Issue state changes trigger task status updates
- Comments can trigger task notes

### TaskMaster → GitHub  
- Task completion closes sub-issues
- Progress updates parent issue
- Dependencies automatically tracked

### Automatic Linear Sync
If you have Linear's GitHub Issues Sync configured:
- GitHub issues automatically appear in Linear
- Status updates sync bidirectionally
- Comments sync between platforms
- No additional configuration needed

## Benefits

1. **Native GitHub Workflow**: Everything stays in GitHub
2. **Clear Hierarchy**: Parent issue → Sub-issues → Commits
3. **Linear Compatible**: Can sync if Linear is set up
4. **Self-Contained**: Works without external dependencies
5. **Traceable**: Full audit trail in issues and commits

## Example Flow

```
User: "@claude use TaskMaster to build a user auth system"
  ↓
1. Claude generates PRD
2. Updates issue #15 with PRD
3. Creates sub-issues #16-#23 (8 tasks)
4. Comments with task mapping table
5. Starts executing Task #1
6. Commits with "feat: [Task #1] Setup auth structure"
7. Closes issue #16
8. Updates parent #15 (12.5% complete)
9. Continues with Task #2...
...
10. All tasks done, creates PR
11. PR closes parent issue #15
```

## Commands

### Check Progress
```bash
# In parent issue comment
@claude what's the task progress?
```

### Execute Next Task
```bash
# In parent issue comment  
@claude continue with the next task
```

### Update Specific Task
```bash
# In sub-issue comment
@claude this task needs to also handle OAuth
```