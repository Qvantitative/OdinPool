# Architecture Overview - OdinPool

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Browser                               │
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │   Next.js App     │  │   WebSocket      │  │   Static Assets  │  │
│  │   (React UI)      │◄─┤   Client         │  │   (Images, etc)  │  │
│  └────────┬──────────┘  └────────┬─────────┘  └─────────────────┘  │
└───────────┼──────────────────────┼──────────────────────────────────┘
            │ HTTPS                │ WSS
            │                      │
┌───────────▼──────────────────────▼──────────────────────────────────┐
│                      OdinPool Server (HTTPS)                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Express.js Server                       │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │    │
│  │  │  Next.js     │  │  Socket.io   │  │  API Routes      │  │    │
│  │  │  SSR Engine  │  │  WebSocket   │  │  /api/*          │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │                                       │
│  ┌──────────────────────────┼────────────────────────────────────┐  │
│  │        Background Jobs (Cron)                                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │  │
│  │  │ cronJob    │  │ cronJobB   │  │ cronJobC               │  │  │
│  │  │ (Main)     │  │ (Backup)   │  │ (Cleanup)              │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └───────┬────────────────┘  │  │
│  └────────┼───────────────┼──────────────────┼───────────────────┘  │
│           │               │                  │                      │
└───────────┼───────────────┼──────────────────┼──────────────────────┘
            │               │                  │
            ▼               ▼                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  PostgreSQL  │  │  Bitcoin     │  │  Ord Server          │    │
│  │  Database    │  │  Core RPC    │  │  (Ordinals API)      │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │  Mempool.js  │  │  External    │                              │
│  │  API         │  │  APIs        │                              │
│  └──────────────┘  └──────────────┘                              │
└───────────────────────────────────────────────────────────────────┘
```

## Component Overview

### Frontend Layer

#### Next.js Application
- **Location:** `/app/src/app/`
- **Purpose:** Server-side rendered React application
- **Key Components:**
  - Landing page
  - Dashboard
  - Analytics views
  - Wallet integration UI

#### React Components
- **Location:** `/app/src/components/`
- **Categories:**
  - Wallet components (balance, inscriptions, Xverse integration)
  - Block explorer components
  - Charts and visualizations
  - Data tables

#### Static Assets
- **Location:** `/public/`
- **Contents:** Images, fonts, icons

### Backend Layer

#### Express.js Server
- **File:** `server.js`
- **Responsibilities:**
  - Serve Next.js application
  - Handle API requests
  - Manage WebSocket connections
  - Proxy Bitcoin RPC calls
  - Database operations

#### API Routes
- **Location:** `/pages/api/`
- **Endpoints:**
  - `/api/bitcoin-blocks` - Block data
  - `/api/bitcoin-methods` - Bitcoin RPC proxy
  - `/api/ordinals` - Ordinals/Inscriptions
  - `/api/raw-transaction` - Transaction details
  - `/api/address-info` - Address information

#### WebSocket Server (Socket.io)
- **Purpose:** Real-time data updates
- **Events:**
  - New block notifications
  - Transaction updates
  - Rune activity updates
  - Price/market updates

### Background Jobs

#### Cron Jobs
- **cronJob.mjs** - Main blockchain data synchronization
- **cronJobB.mjs** - Backup/secondary sync
- **cronJobC.mjs** - Data cleanup and maintenance

#### Data Processing Scripts
- **updateBlockchainData.mjs** - Update block/transaction data
- **updateRawTransaction.mjs** - Process raw transaction details
- **updateTransactionData.mjs** - Update transaction metadata
- **backfillBlockchainData.mjs** - Historical data backfill
- **backfillMissingBlocks.mjs** - Fill gaps in block data
- **processLastBlocks.mjs** - Process recent blocks

### Data Layer

#### PostgreSQL Database
- **Tables:**
  - `blocks` - Bitcoin block data
  - `runes_activities` - Rune protocol transactions
  - `runes_activities2` - Secondary rune tracking
  - `inscription_checkpoints` - Ordinals processing state
  - `rune_process_checkpoints` - Rune processing state
  - `rune_wallet_process_checkpoints` - Wallet sync state

#### Bitcoin Core RPC
- **Host:** Configured via environment
- **Port:** 8332 (default mainnet)
- **Operations:**
  - Block fetching
  - Transaction retrieval
  - Mempool queries
  - Network information

#### Ord Server
- **Purpose:** Ordinals/Inscriptions API
- **Operations:**
  - Inscription metadata
  - Ordinal numbering
  - Collection data

#### External APIs
- **Mempool.js API** - Blockchain explorer data
- **Magic Eden API** - NFT marketplace data
- **Best in Slot API** - Bitcoin NFT data

### Utility Libraries

#### lib/db.js
- Database connection and query utilities
- Block data operations
- Transaction helpers

#### lib/chainAPI.js
- Blockchain API wrappers
- Bitcoin RPC helpers
- Data transformation utilities

#### lib/mempoolAPI.js
- Mempool.space API client
- Fee estimation
- UTXO queries

#### lib/magicEdenAPI.js
- Magic Eden marketplace integration
- Collection data fetching

#### lib/useFetchBTC.js
- React hook for BTC price fetching
- Market data utilities

## Data Flow

### Block Processing Flow

```
1. Cron Job Triggers (scheduled)
   ↓
2. Fetch Latest Block from Bitcoin Core
   ↓
3. Process Block Data
   - Parse transactions
   - Identify Runes operations
   - Extract Ordinals inscriptions
   ↓
4. Store in PostgreSQL
   - Update blocks table
   - Update runes_activities
   - Update checkpoints
   ↓
5. Broadcast via WebSocket
   - Notify connected clients
   - Update dashboards in real-time
```

### User Request Flow

```
1. User Visits Page
   ↓
2. Next.js SSR
   - Fetch initial data from database
   - Render React components
   ↓
3. Client-Side Hydration
   - Establish WebSocket connection
   - Subscribe to real-time updates
   ↓
4. User Interaction (e.g., search block)
   ↓
5. API Request to /api/bitcoin-blocks
   ↓
6. Server Queries Database
   ↓
7. Response Returned to Client
   ↓
8. React Updates UI
```

### Real-Time Update Flow

```
1. New Block Detected (cron job)
   ↓
2. Process and Store in Database
   ↓
3. Server Emits WebSocket Event
   socket.emit('newBlock', blockData)
   ↓
4. Connected Clients Receive Event
   ↓
5. React Components Update State
   ↓
6. UI Re-renders with New Data
```

## Security Architecture

### SSL/TLS
- HTTPS enforced for all client connections
- Let's Encrypt certificates
- WebSocket over TLS (WSS)

### CORS
- Whitelist of allowed origins
- Credentials enabled for authenticated requests

### Database
- Connection pooling
- Parameterized queries (SQL injection prevention)
- SSL connections (configurable)

### Environment Variables
- All sensitive data in .env
- Not committed to version control
- Different configs for dev/prod

### API Security
- Input validation needed (TODO)
- Rate limiting needed (TODO)
- Authentication for sensitive endpoints (TODO)

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────┐
│              Load Balancer (Optional)           │
│                   (HTTPS)                       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           OdinPool Application Server           │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  PM2 Process Manager                      │  │
│  │  ┌────────────┐  ┌────────────────────┐   │  │
│  │  │  server.js │  │  Cron Jobs         │   │  │
│  │  │  (Node.js) │  │  (Background)      │   │  │
│  │  └────────────┘  └────────────────────┘   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
            │                      │
            │                      │
    ┌───────▼──────┐      ┌───────▼──────────┐
    │  PostgreSQL  │      │  Bitcoin Core    │
    │  (Digital    │      │  Full Node       │
    │   Ocean)     │      │  (Local/Remote)  │
    └──────────────┘      └──────────────────┘
```

### Development Environment

```
┌─────────────────────────────────────────────┐
│         Developer Machine                   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  npm run dev                         │   │
│  │  ┌────────────┐  ┌────────────────┐  │   │
│  │  │  Next.js   │  │  Express       │  │   │
│  │  │  Dev Server│  │  Dev Server    │  │   │
│  │  └────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
        │                         │
        │                         │
  ┌─────▼──────┐         ┌───────▼──────────┐
  │ PostgreSQL │         │  Bitcoin Core    │
  │ (Local or  │         │  (Testnet or     │
  │  Remote)   │         │   Mainnet)       │
  └────────────┘         └──────────────────┘
```

## Scalability Considerations

### Current Limitations
- Single server deployment
- Single database instance
- No caching layer
- No load balancing

### Future Improvements
1. **Horizontal Scaling:**
   - Multiple application servers
   - Load balancer (Nginx/HAProxy)
   - Session affinity for WebSocket

2. **Database Scaling:**
   - Read replicas for queries
   - Write master for updates
   - Connection pooling optimization

3. **Caching:**
   - Redis for frequently accessed data
   - CDN for static assets
   - API response caching

4. **Microservices (Optional):**
   - Separate blockchain data service
   - Dedicated WebSocket service
   - API gateway

## Monitoring & Logging

### Current State
- Console logging throughout
- No centralized logging
- No monitoring dashboard

### Recommended Additions
1. **Application Monitoring:**
   - PM2 for process management
   - Health check endpoints
   - Performance metrics

2. **Logging:**
   - Winston or Pino for structured logging
   - Log aggregation (ELK stack or similar)
   - Error tracking (Sentry)

3. **Metrics:**
   - Database query performance
   - API response times
   - WebSocket connection count
   - Cron job execution time

4. **Alerts:**
   - Server downtime
   - Database connection failures
   - Bitcoin node unavailability
   - High error rates

## Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TailwindCSS |
| Backend | Express.js, Node.js |
| Real-time | Socket.io (WebSocket) |
| Database | PostgreSQL |
| Blockchain | Bitcoin Core RPC, Mempool.js |
| Charts | Chart.js, Recharts, Plotly.js |
| Build | Next.js build system |
| Package Manager | npm |

## Development Tools

- **ESLint** - Code linting
- **Autoprefixer** - CSS vendor prefixes
- **PostCSS** - CSS processing
- **Rimraf** - Clean build artifacts

## Next Steps for Architecture Improvement

1. Add comprehensive error handling and logging
2. Implement caching layer (Redis)
3. Add API rate limiting
4. Implement health check endpoints
5. Add monitoring and alerting
6. Create database migration system
7. Add automated testing
8. Implement CI/CD pipeline
9. Document API with Swagger/OpenAPI
10. Consider microservices architecture for scaling

---

This architecture supports the current functionality well but would benefit from the improvements listed above for production-grade reliability and scalability.
