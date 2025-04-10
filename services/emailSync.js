const Imap = require('imap');
const { simpleParser } = require('mailparser');
const imapConfig = require('../config/imapConfig');


const fetchEmailsFromLast30Days = (imap) => {
  return new Promise((resolve, reject) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    const formattedDate = sinceDate.toISOString().split('T')[0];

    imap.search(['ALL', ['SINCE', formattedDate]], (err, results) => {
      if (err) return reject(err);

      if (!results || !results.length) {
        console.log('No emails found.');
        return resolve([]);
      }

      const limitedResults = results.slice(0, 50);
      const fetch = imap.fetch(limitedResults, { bodies: '' });
      const emails = [];

      fetch.on('message', (msg) => {
        msg.on('body', async (stream) => {
          const parsedEmail = await simpleParser(stream);
          emails.push({
            subject: parsedEmail.subject || '[No Subject]',
            from: parsedEmail.from?.text || '[No Sender]',
            date: parsedEmail.date || new Date(),
            text: (parsedEmail.text || '').substring(0, 100) + '...'
          });
        });
      });

      fetch.on('end', () => resolve(emails));
      fetch.on('error', reject);
    });
  });
};


const fetchNewEmails = (imap, numNew) => {
  return new Promise((resolve, reject) => {
    imap.search(['UNSEEN'], (err, results) => {
      if (err) return reject(err);

      if (!results || !results.length) {
        console.log('No new emails found.');
        return resolve([]);
      }

      
      const sortedResults = results.sort((a, b) => b - a); 
      const latestResults = sortedResults.slice(0, numNew); 
      const fetch = imap.fetch(latestResults, { bodies: '' });
      const emails = [];

      fetch.on('message', (msg) => {
        msg.on('body', async (stream) => {
          const parsedEmail = await simpleParser(stream);
          emails.push({
            subject: parsedEmail.subject || '[No Subject]',
            from: parsedEmail.from?.text || '[No Sender]',
            date: parsedEmail.date || new Date(),
            text: (parsedEmail.text || '').substring(0, 100) + '...'
          });
        });
      });

      fetch.on('end', () => resolve(emails));
      fetch.on('error', reject);
    });
  });
};


const setupImapConnection = (config) => {
  const imap = new Imap(config);

  imap.once('ready', async () => {
    console.log(`Connected to ${config.user}`);
    
    imap.openBox('INBOX', false, async (err, box) => {
      if (err) {
        console.error(`Failed to open INBOX for ${config.user}:`, err);
        return;
      }

      console.log(`Fetching emails for ${config.user}...`);
      try {
        const emails = await fetchEmailsFromLast30Days(imap);
        console.log(`Fetched ${emails.length} emails:`);
        console.log(emails);
      } catch (err) {
        console.error(`Error fetching emails for ${config.user}:`, err);
      }

      imap.on('mail', async (num) => {
        console.log(`New email(s) received for ${config.user}: ${num}`);
        try {
          const newEmails = await fetchNewEmails(imap, num); // Pass num from mail event
          console.log(`Fetched ${newEmails.length} new emails:`);
          console.log(newEmails);
        } catch (err) {
          console.error(`Error fetching new emails for ${config.user}:`, err);
        }
      });
    });
  });

  imap.on('error', (err) => {
    console.error(`Error with ${config.user}:`, err);
    if (err.code === 'ECONNRESET') {
      console.log(`Reconnecting to ${config.user}...`);
      setTimeout(() => {
        imap.end();
        imap.connect();
      }, 5000);
    }
  });

  imap.once('end', () => {
    console.log(`Connection ended for ${config.user}`);
  });

  imap.connect();
};

const startImapSync = () => {
  imapConfig.forEach((config) => setupImapConnection(config));
};

module.exports = { startImapSync };