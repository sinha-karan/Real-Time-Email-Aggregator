# Real-Time Email Aggregator
## Setup
- **Elasticsearch**: `docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.13.0`
- **App**: `cd C:\reachinbox-assignment`, `npm install`, `npm start`

# Real-Time Email Aggregator

## Features
- **Feature 1**: Sets up Elasticsearch index and stores a test email on startup.
- **Feature 2**: Searchable via `/search?q=`.

## Docker Setup
1. **Elasticsearch**:
   - `docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.13.0`
2. **App**:
   - `docker build -t reachinbox-app .`
   - `docker run -d --name reachinbox-app -p 3000:3000 --link elasticsearch:elasticsearch reachinbox-app`

## Testing
- Root: `http://localhost:3000`
- Search: `http://localhost:3000/search?q=hello` (returns test email)
