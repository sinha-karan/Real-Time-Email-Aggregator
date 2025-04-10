const Imap = require('imap');
const { simpleParser } = require('mailparser');
const imapConfig = require('../config/imapConfig');

// Helper function to fetch emails from the last 30 days
const fetchEmailsFromLast30Days = (imap) => {
  return new Promise((resolve, reject) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);

    imap.search(['ALL', ['SINCE', sinceDate.toISOString()]], (err, results) => {
      if (err) return reject(err);

      if (!results || !results.length) {
        console.log('No emails found.');
        return resolve([]);
      }

      const fetch = imap.fetch(results, { bodies: '' });
      const emails = [];

      fetch.on('message', (msg) => {
        msg.on('body', async (stream) => {
          const parsedEmail = await simpleParser(stream);
          emails.push({
            subject: parsedEmail.subject,
            from: parsedEmail.from.text,
            date: parsedEmail.date,
            text: parsedEmail.text,
          });
        });
      });

      fetch.on('end', () => resolve(emails));
      fetch.on('error', reject);
    });
  });
};

// Function to set up real-time sync using IDLE mode
const setupImapConnection = (config) => {
  const imap = new Imap(config);

  imap.once('ready', async () => {
    console.log(`Connected to ${config.user}`);
    
    imap.openBox('INBOX', false, async (err, box) => {
      if (err) throw err;

      // Fetch last 30 days of emails
      console.log(`Fetching emails for ${config.user}...`);
      const emails = await fetchEmailsFromLast30Days(imap);
      console.log(`Fetched ${emails.length} emails.`);

      // Listen for new emails in real-time
      imap.on('mail', async () => {
        console.log(`New email received for ${config.user}`);
        const newEmails = await fetchEmailsFromLast30Days(imap);
        console.log(newEmails);
      });
    });
  });

  imap.once('error', (err) => {
    console.error(`Error with ${config.user}:`, err);
  });

  imap.once('end', () => {
    console.log(`Connection ended for ${config.user}`);
  });

  imap.connect();
};

// Export function to start syncing all accounts
const startImapSync = () => {
  imapConfig.forEach((config) => setupImapConnection(config));
};

module.exports = { startImapSync };