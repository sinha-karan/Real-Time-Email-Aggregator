const express = require('express');
const elasticSearch = require('./services/elasticSearch');
const app = express();

(async () => {
  console.log('Waiting for Elasticsearch to start...');
  await new Promise(resolve => setTimeout(resolve, 20000));
  const indexCreated = await elasticSearch.ensureIndex();
  if (indexCreated) {
    console.log('Storing test email...');
    await elasticSearch.storeEmails('test@example.com', [{
      uid: 1,
      subject: 'Test Email',
      from: 'test@example.com',
      date: new Date(),
      text: 'Hello, this is a test email'
    }]);
  } else {
    console.log('Elasticsearch not available, skipping test email store');
  }

  app.get('/', (req, res) => {
    res.send('Welcome to ReachInbox - Search emails at /search?q=<query>');
  });

  app.get('/search', async (req, res) => {
    try {
      const query = req.query.q || 'test';
      console.log('Searching Elasticsearch for:', query);
      const results = await elasticSearch.searchEmails(query);
      console.log('Search results:', results);
      res.json(results);
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.listen(3000, () => {
    console.log('ReachInbox assignment server is running on port 3000');
  });
})();