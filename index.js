const express = require('express');
const elasticSearch = require('./services/elasticSearch');
const app = express();

(async () => {
  await elasticSearch.ensureIndex(); // Initialize index

  app.get('/', (req, res) => {
    res.send('Welcome to ReachInbox - Search emails at /search?q=<query>');
  });

  app.get('/search', async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
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