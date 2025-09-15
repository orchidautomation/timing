import express from 'express';
import crypto from 'crypto';
import { LinearClient } from '@linear/sdk';
import { handleCommand } from './commands.js';
import { validateWebhook } from './utils.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

const linearClient = new LinearClient({ apiKey: LINEAR_API_KEY });

app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    bot: 'Linear TaskMaster Agent',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/webhook', async (req, res) => {
  try {
    if (WEBHOOK_SECRET && !validateWebhook(req, WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { action, type, data } = req.body;

    if (type === 'Comment' && action === 'create') {
      const comment = data;

      if (comment.body && comment.body.startsWith('/taskmaster')) {
        console.log(`Processing command from issue ${comment.issueId}: ${comment.body}`);

        const issue = await linearClient.issue(comment.issueId);
        const result = await handleCommand(comment.body, issue, {
          linearClient,
          githubToken: GITHUB_TOKEN,
          githubRepo: GITHUB_REPO
        });

        if (result.message) {
          await linearClient.createComment({
            issueId: comment.issueId,
            body: result.message
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Linear TaskMaster Bot running on port ${PORT}`);
  console.log('Environment check:');
  console.log('- LINEAR_API_KEY:', LINEAR_API_KEY ? '✓' : '✗');
  console.log('- WEBHOOK_SECRET:', WEBHOOK_SECRET ? '✓' : '✗');
  console.log('- GITHUB_TOKEN:', GITHUB_TOKEN ? '✓' : '✗');
  console.log('- GITHUB_REPO:', GITHUB_REPO ? '✓' : '✗');
});