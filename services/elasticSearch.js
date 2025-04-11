const { Client } = require('@elastic/elasticsearch');

class ElasticSearchManager {
  constructor() {
    this.client = new Client({ 
      node: 'http://elasticsearch:9200' // Docker link name
    });
    this.indexName = 'emails';
  }

  async ensureIndex() {
    try {
      const { body: exists } = await this.client.indices.exists({ 
        index: this.indexName 
      });
      
      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                uid: { type: 'keyword' },
                subject: { type: 'text' },
                from: { type: 'keyword' },
                date: { type: 'date' },
                text: { type: 'text' },
                account: { type: 'keyword' }
              }
            }
          }
        });
        console.log(`Created index: ${this.indexName}`);
      } else {
        console.log(`Index ${this.indexName} already exists`);
      }
      return true;
    } catch (err) {
      console.error('Index initialization failed:', err);
      return false; // Don’t crash
    }
  }

  async storeEmails(account, emails) {
    if (!emails || !emails.length) return { success: true };

    try {
      const body = emails.flatMap(email => [
        { index: { _index: this.indexName, _id: `${account}-${email.uid}` } },
        { ...email, account }
      ]);

      const response = await this.client.bulk({ 
        body,
        refresh: true // Ensure immediate search availability
      });

      if (response.errors) {
        console.error('Bulk indexing errors:', response.items);
        return { success: false };
      }
      
      console.log(`Stored ${emails.length} emails for ${account}`);
      return { success: true };
    } catch (err) {
      console.error('Bulk index error:', err);
      return { success: false };
    }
  }

  async searchEmails(query) {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['subject', 'text', 'from']
            }
          }
        }
      });
      return result.hits.hits.map(hit => hit._source);
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  }
}

module.exports = new ElasticSearchManager();