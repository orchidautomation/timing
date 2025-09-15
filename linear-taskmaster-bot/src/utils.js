import crypto from 'crypto';

export function validateWebhook(req, secret) {
  const signature = req.headers['linear-signature'];
  if (!signature) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return signature === hash;
}

export function formatTaskList(tasks) {
  return tasks.map((task, index) => {
    const status = task.status === 'done' ? '✅' :
                   task.status === 'in-progress' ? '🔄' : '⏳';
    return `${status} ${index + 1}. ${task.title}`;
  }).join('\n');
}

export function parseLinearCommand(text) {
  const match = text.match(/^\/taskmaster\s+(\w+)(?:\s+(.+))?$/);
  if (!match) return null;

  return {
    command: match[1],
    args: match[2] ? match[2].split(' ') : []
  };
}