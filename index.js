const express = require('express');
const { startImapSync } = require('./services/emailSync');
const elasticSearch = require('./services/elasticSearch');
const imapConfig = require('./config/imapConfig');

const app = express();
const PORT = process.env.PORT || 3000;

const syncManager = startImapSync(imapConfig);

syncManager.on('error', ({ account, error }) => {
  console.error(`Handled error for ${account}:`, error);
});

syncManager.on('emails', ({ account, emails, isNew }) => {
  console.log(`Received ${emails.length} ${isNew ? 'new' : 'recent'} emails for ${account}:`, emails);
});

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });
  const results = await elasticSearch.searchEmails(query);
  res.json(results);
});

app.listen(PORT, () => {
  console.log(`ReachInbox assignment server is running on port ${PORT}`);
});