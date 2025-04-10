const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { promisify } = require('util');
const EventEmitter = require('events');

class EmailSyncManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.accounts = {};
    this.connectionStates = {};
    this.monitors = {};
  }

  start() {
    this.config.forEach(account => {
      this.setupAccount(account);
    });
    return this;
  }

  setupAccount(account) {
    if (this.accounts[account.user]) {
      this.closeAccount(account.user);
    }

    const imap = new Imap(account);
    this.accounts[account.user] = imap;
    this.connectionStates[account.user] = 'connecting';

    imap.once('ready', () => {
      this.connectionStates[account.user] = 'connected';
      console.log(`Connected to ${account.user}`);
      this.setupMailbox(account.user);
    });

    imap.on('error', (err) => {
      console.error(`Error with ${account.user}:`, err);
      this.connectionStates[account.user] = 'error';
      this.emit('error', { account: account.user, error: err });
      this.scheduleReconnect(account);
    });

    imap.once('end', () => {
      console.log(`Connection ended for ${account.user}`);
      this.connectionStates[account.user] = 'disconnected';
      this.emit('disconnected', { account: account.user });
      if (this.monitors[account.user]) {
        clearInterval(this.monitors[account.user]);
        delete this.monitors[account.user];
      }
    });

    imap.connect();
    return this;
  }

  scheduleReconnect(account) {
    const currentAttempt = account._reconnectAttempts || 0;
    account._reconnectAttempts = currentAttempt + 1;
    const baseDelay = 5000;
    const maxDelay = 300000;
    const delay = Math.min(baseDelay * Math.pow(1.5, currentAttempt), maxDelay);
    console.log(`Scheduling reconnect for ${account.user} in ${delay/1000} seconds`);
    setTimeout(() => {
      if (this.connectionStates[account.user] !== 'connected') {
        console.log(`Attempting to reconnect ${account.user}...`);
        this.setupAccount(account);
      } else {
        account._reconnectAttempts = 0;
      }
    }, delay);
  }

  async setupMailbox(user) {
    const imap = this.accounts[user];
    if (!imap || this.connectionStates[user] !== 'connected') {
      console.error(`Cannot set up mailbox for ${user}: not connected`);
      return;
    }
  
    console.log(`Setting up mailbox for ${user}`);
    try {
      const openBox = promisify(imap.openBox.bind(imap));
      await openBox('INBOX', true);
      console.log(`Opened INBOX for ${user}`);
      console.log(`Starting email sync for ${user}`);
      await this.syncRecentEmails(user);
      console.log(`Initial sync completed for ${user}`);
      this.setupRealTimeSync(user);
      this.setupConnectionMonitor(user);
      const account = this.config.find(acc => acc.user === user);
      if (account) {
        account._reconnectAttempts = 0;
      }
    } catch (err) {
      console.error(`Failed to set up mailbox for ${user}:`, err);
      this.emit('error', { account: user, error: err });
      const account = this.config.find(acc => acc.user === user);
      if (account) {
        this.scheduleReconnect(account);
      }
    }
  }

  async syncRecentEmails(user) {
    console.log(`Starting initial sync for ${user}...`);
    const imap = this.accounts[user];
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const formattedDate = thirtyDaysAgo.toISOString().split('T')[0];
      const results = await this.imapSearch(imap, ['ALL', ['SINCE', formattedDate]]);
      console.log(`Found ${results.length} emails in the last 30 days for ${user}`);
      await this.processBatches(user, results.slice(0, 50));
      console.log(`Processed all batches for ${user}`);
    } catch (err) {
      console.error(`Error syncing recent emails for ${user}:`, err);
      throw err;
    }
  }

  async processBatches(user, results) {
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < results.length; i += batchSize) {
      batches.push(results.slice(i, i + batchSize));
    }
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i+1}/${batches.length} for ${user} (${batch.length} emails)`);
      try {
        const emails = await this.fetchEmailBatch(user, batch);
        this.emit('emails', { account: user, emails, isNew: false });
      } catch (err) {
        console.error(`Error processing batch ${i+1} for ${user}:`, err);
      }
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async fetchEmailBatch(user, uids) {
    const imap = this.accounts[user];
    if (!imap || this.connectionStates[user] !== 'connected') {
      throw new Error(`Cannot fetch emails for ${user}: not connected`);
    }
    return new Promise((resolve, reject) => {
      try {
        const fetch = imap.fetch(uids, { bodies: '' });
        const emails = [];
        fetch.on('message', (msg) => {
          let buffer = '';
          msg.on('body', (stream) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });
          msg.once('attributes', (attrs) => {
            msg.attrs = attrs;
          });
          msg.once('end', async () => {
            try {
              const parsedEmail = await simpleParser(buffer);
              emails.push({
                uid: msg.attrs?.uid,
                subject: parsedEmail.subject || '[No Subject]',
                from: parsedEmail.from?.text || '[No Sender]',
                date: parsedEmail.date || new Date(),
                text: (parsedEmail.text || '').substring(0, 100) + '...'
              });
            } catch (err) {
              console.error(`Error parsing email for ${user}:`, err);
            }
          });
        });
        fetch.once('error', (err) => {
          reject(err);
        });
        fetch.once('end', () => {
          resolve(emails);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  setupRealTimeSync(user) {
    const imap = this.accounts[user];
    imap.on('mail', async (numNew) => {
      console.log(`${numNew} new email(s) received for ${user}`);
      try {
        await this.fetchNewEmails(user, numNew);
      } catch (err) {
        console.error(`Error fetching new emails for ${user}:`, err);
      }
    });
  
    console.log(`Setting up real-time sync for ${user}`);
    this.checkForNewEmails(user);
    this.setupPolling(user); // Always poll, skip IDLE for now
  }

  setupPolling(user) {
    if (this.monitors[`${user}_poll`]) {
      clearInterval(this.monitors[`${user}_poll`]);
    }
    const POLLING_INTERVAL = 15000; // 15 seconds for faster testing
    console.log(`Setting up polling every ${POLLING_INTERVAL/1000} seconds for ${user}`);
    this.monitors[`${user}_poll`] = setInterval(async () => {
      if (this.connectionStates[user] === 'connected') {
        await this.checkForNewEmails(user);
      }
    }, POLLING_INTERVAL);
  }
  
  // Add this new method (reused from polling logic)
  async checkForNewEmails(user) {
    const imap = this.accounts[user];
    console.log(`Checking for new emails for ${user}`);
    try {
      const results = await this.imapSearch(imap, ['UNSEEN']);
      if (results.length > 0) {
        console.log(`Found ${results.length} unseen emails for ${user} on check`);
        const sortedResults = results.sort((a, b) => b - a);
        const latestResults = sortedResults.slice(0, 5);
        const emails = await this.fetchEmailBatch(user, latestResults);
        this.emit('emails', { account: user, emails, isNew: true });
      } else {
        console.log(`No unseen emails found for ${user} on check`);
      }
    } catch (err) {
      console.error(`Error checking for new emails for ${user}:`, err);
    }
  }

  imapSearch(imap, criteria) {
    return new Promise((resolve, reject) => {
      imap.search(criteria, (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results || []);
      });
    });
  }

  setupConnectionMonitor(user) {
    if (this.monitors[`${user}_monitor`]) {
      clearInterval(this.monitors[`${user}_monitor`]);
    }
    const MONITOR_INTERVAL = 30000;
    this.monitors[`${user}_monitor`] = setInterval(async () => {
      const imap = this.accounts[user];
      const currentState = imap ? imap.state : 'unknown';
      console.log(`Connection state for ${user}: ${currentState}`);
      if (imap && currentState === 'authenticated') {
        try {
          await this.imapSearch(imap, ['ALL']); // Simple search to keep alive
          console.log(`Sent keep-alive SEARCH to ${user}`);
        } catch (err) {
          console.error(`Error sending keep-alive for ${user}:`, err);
        }
      }
      if (imap && (currentState === 'disconnected' || currentState === 'unknown')) {
        console.log(`Connection appears broken for ${user}, attempting recovery`);
        const account = this.config.find(acc => acc.user === user);
        if (account) {
          this.closeAccount(user);
          this.setupAccount(account);
        }
      }
    }, MONITOR_INTERVAL);
  }

  closeAccount(user) {
    console.log(`Closing connection for ${user}`);
    Object.keys(this.monitors).forEach(key => {
      if (key === user || key.startsWith(`${user}_`)) {
        clearInterval(this.monitors[key]);
        delete this.monitors[key];
      }
    });
    const imap = this.accounts[user];
    if (imap) {
      try {
        if (imap.state !== 'disconnected') {
          imap.end();
        }
      } catch (err) {
        console.error(`Error ending connection for ${user}:`, err);
      }
      delete this.accounts[user];
      this.connectionStates[user] = 'closed';
    }
    return this;
  }

  close() {
    console.log('Closing all email connections');
    Object.keys(this.monitors).forEach(key => {
      clearInterval(this.monitors[key]);
    });
    this.monitors = {};
    Object.keys(this.accounts).forEach(user => {
      const imap = this.accounts[user];
      if (imap && imap.state !== 'disconnected') {
        try {
          imap.end();
        } catch (err) {
          console.error(`Error ending connection for ${user}:`, err);
        }
      }
    });
    this.accounts = {};
    this.connectionStates = {};
    return this;
  }

  getStatus() {
    return {
      accounts: Object.keys(this.accounts).length,
      states: this.connectionStates
    };
  }
}

function startImapSync(config) {
  const syncManager = new EmailSyncManager(config);
  syncManager.on('emails', ({ account, emails, isNew }) => {
    console.log(`Received ${emails.length} ${isNew ? 'new' : 'recent'} emails for ${account}:`);
    console.log(emails);
  });
  syncManager.start();
  return syncManager;
}

module.exports = { startImapSync, EmailSyncManager };