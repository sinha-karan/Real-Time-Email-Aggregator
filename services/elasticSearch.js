const { Client } = require('@elastic/elasticsearch');

class ElasticSearchManager {
  constructor() {
    this.client = new Client({ node: 'http://elasticsearch:9200'
    });
  }

  async ensureIndex() {
    try {
      const exists = await this.client.indices.exists({ index: 'emails' });
      if (!exists.body) {
        await this.client.indices.create({
          index: 'emails',
          body: {
            mappings: {
              properties: {
                uid: { type: 'integer' },
                subject: { type: 'text' },
                from: { type: 'text' },
                date: { type: 'date' },
                text: { type: 'text' }
              }
            }
          }
        });
        console.log('Created Elasticsearch index: emails');
      } else {
        console.log('Elasticsearch index "emails" already exists');
      }
    } catch (err) {
      console.error('Error creating Elasticsearch index:', err);
    }
  }

  async storeEmails(account, emails) {
    try {
      const body = emails.flatMap(email => [
        { index: { _index: 'emails', _id: `${account}-${email.uid}` } },
        email
      ]);
      console.log(`Preparing to store ${emails.length} emails for ${account}`);
      const response = await this.client.bulk({ 
        body: body,
        refresh: true
      });
      console.log('Bulk response:', response);
      if (response.errors) {
        console.error('Errors storing emails:', response.items);
      } else {
        console.log(`Stored ${emails.length} emails for ${account} in Elasticsearch`);
      }
    } catch (err) {
      console.error('Error storing emails:', err);
    }
  }

  async searchEmails(query) {
    try {
      const result = await this.client.search({
        index: 'emails',
        body: {
          query: {
            multi_match: {
              query,
              fields: ['subject', 'from', 'text']
            }
          }
        }
      });
      return result.body.hits.hits.map(hit => hit._source);
    } catch (err) {
      console.error('Error searching emails:', err);
      return [];
    }
  }
}

module.exports = new ElasticSearchManager();