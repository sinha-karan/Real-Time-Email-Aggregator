# ReachInbox Assignment
## Setup
- **Elasticsearch**: `docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.13.0`
- **App**: `cd C:\reachinbox-assignment`, `npm install`, `npm start`