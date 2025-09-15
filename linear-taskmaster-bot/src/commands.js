import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

export async function handleCommand(commandText, issue, context) {
  const { linearClient, githubToken, githubRepo } = context;
  const parts = commandText.split(' ');
  const command = parts[1]?.toLowerCase();

  switch (command) {
    case 'parse':
      return await handleParse(issue, context);

    case 'expand':
      const taskId = parts[2];
      return await handleExpand(issue, taskId, context);

    case 'status':
      return await handleStatus(issue, context);

    case 'sync':
      return await handleSync(issue, context);

    case 'help':
      return handleHelp();

    default:
      return {
        message: `Unknown command: ${command}. Type \`/taskmaster help\` for available commands.`
      };
  }
}

async function handleParse(issue, context) {
  try {
    const teamId = issue.teamId;
    const projectName = issue.team?.name || 'project';

    const prdContent = `# ${issue.title}

${issue.description || 'No description provided'}

## Requirements
${extractRequirements(issue.description)}

## Success Criteria
- Issue successfully resolved
- All acceptance criteria met
- Tests passing
`;

    try {
      const { stdout } = await execAsync(`
        cd /tmp && \
        mkdir -p taskmaster-${issue.id} && \
        cd taskmaster-${issue.id} && \
        echo '${prdContent.replace(/'/g, "'\\''")}' > prd.txt && \
        npx task-master-ai parse-prd --input prd.txt --num-tasks 5 2>&1
      `);

      const tasks = parseTaskMasterOutput(stdout);

      let responseMessage = `✅ **TaskMaster Parse Complete**

Generated ${tasks.length} tasks from your issue:

`;
      tasks.forEach((task, index) => {
        responseMessage += `${index + 1}. ${task.title}\n`;
      });

      responseMessage += `
To expand a task, use: \`/taskmaster expand [task-number]\`
To see progress, use: \`/taskmaster status\``;

      await updateIssueWithTasks(issue.id, tasks, context);

      return { message: responseMessage };
    } catch (error) {
      console.error('TaskMaster execution error:', error);
      return {
        message: `⚠️ TaskMaster parsing failed. Make sure your issue description contains enough detail for task generation.

Error: ${error.message}`
      };
    }
  } catch (error) {
    console.error('Parse error:', error);
    return {
      message: `❌ Failed to parse issue: ${error.message}`
    };
  }
}

async function handleExpand(issue, taskId, context) {
  if (!taskId) {
    return {
      message: '⚠️ Please specify a task ID to expand. Usage: `/taskmaster expand [task-id]`'
    };
  }

  try {
    const { stdout } = await execAsync(`
      cd /tmp/taskmaster-${issue.id} && \
      npx task-master-ai expand --id ${taskId} --num 3 2>&1
    `);

    const subtasks = parseTaskMasterOutput(stdout);

    let responseMessage = `✅ **Task ${taskId} Expanded**

Generated ${subtasks.length} subtasks:

`;
    subtasks.forEach((task, index) => {
      responseMessage += `  ${taskId}.${index + 1}. ${task.title}\n`;
    });

    return { message: responseMessage };
  } catch (error) {
    console.error('Expand error:', error);
    return {
      message: `❌ Failed to expand task ${taskId}: ${error.message}`
    };
  }
}

async function handleStatus(issue, context) {
  try {
    const { stdout } = await execAsync(`
      cd /tmp/taskmaster-${issue.id} 2>/dev/null && \
      npx task-master-ai get-tasks 2>&1 || echo "No tasks found"
    `);

    if (stdout.includes('No tasks found')) {
      return {
        message: '📊 No TaskMaster tasks found for this issue. Use `/taskmaster parse` to generate tasks.'
      };
    }

    const tasks = parseTaskMasterOutput(stdout);
    const completed = tasks.filter(t => t.status === 'done').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;

    return {
      message: `📊 **TaskMaster Status**

**Progress:** ${completed}/${tasks.length} tasks completed

✅ Completed: ${completed}
🔄 In Progress: ${inProgress}
⏳ Pending: ${pending}

Use \`/taskmaster sync\` to sync with GitHub.`
    };
  } catch (error) {
    console.error('Status error:', error);
    return {
      message: `❌ Failed to get status: ${error.message}`
    };
  }
}

async function handleSync(issue, context) {
  const { githubToken, githubRepo } = context;

  if (!githubToken || !githubRepo) {
    return {
      message: '⚠️ GitHub integration not configured. Please set GITHUB_TOKEN and GITHUB_REPO environment variables.'
    };
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: issue.title,
        body: `Linear Issue: ${issue.identifier}

${issue.description}

---
*Synced from Linear by TaskMaster Bot*`,
        labels: ['linear', 'taskmaster']
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const githubIssue = await response.json();

    return {
      message: `✅ **Synced to GitHub**

Created GitHub issue: ${githubIssue.html_url}

The issue will be processed by Claude Code automation.`
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      message: `❌ Failed to sync with GitHub: ${error.message}`
    };
  }
}

function handleHelp() {
  return {
    message: `**TaskMaster Agent Commands**

\`/taskmaster parse\` - Generate tasks from issue description
\`/taskmaster expand [task-id]\` - Break down a task into subtasks
\`/taskmaster status\` - Show current task progress
\`/taskmaster sync\` - Sync issue to GitHub for Claude Code processing
\`/taskmaster help\` - Show this help message

TaskMaster only activates when you explicitly use these commands.`
  };
}

function extractRequirements(description) {
  if (!description) return '- Complete the issue objectives';

  const lines = description.split('\n');
  const requirements = lines
    .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
    .slice(0, 5);

  return requirements.length > 0 ? requirements.join('\n') : '- Complete the issue objectives';
}

function parseTaskMasterOutput(output) {
  const tasks = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const taskMatch = line.match(/(\d+)\.\s+(.+?)(?:\s+\[(.+?)\])?$/);
    if (taskMatch) {
      tasks.push({
        id: taskMatch[1],
        title: taskMatch[2],
        status: taskMatch[3] || 'pending'
      });
    }
  }

  return tasks;
}

async function updateIssueWithTasks(issueId, tasks, context) {
  const { linearClient } = context;

  try {
    const taskList = tasks.map((t, i) => `- [ ] ${i + 1}. ${t.title}`).join('\n');
    const updatedDescription = `${context.issue.description || ''}

## TaskMaster Tasks
${taskList}`;

    await linearClient.updateIssue(issueId, {
      description: updatedDescription
    });
  } catch (error) {
    console.error('Failed to update issue:', error);
  }
}