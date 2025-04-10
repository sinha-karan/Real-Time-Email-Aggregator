const express = require('express');
const { startImapSync } = require('./services/emailSync');
const imapConfig = require('./config/imapConfig');

const app = express();
const PORT = process.env.PORT || 3000;

const syncManager = startImapSync(imapConfig);

syncManager.on('error', ({ account, error }) => {
  console.error(`Handled error for ${account}:`, error);
  // Optionally, take further action like logging to a file or notifying
});

app.listen(PORT, () => {
  console.log(`ReachInbox assignment server is running on port ${PORT}`);
});