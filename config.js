// config.js
// Centralized configuration management for OdinPool

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: `${__dirname}/.env` });

const env = process.env.NODE_ENV || 'development';
const isDevelopment = env === 'development';
const isProduction = env === 'production';
const isTest = env === 'test';

export const config = {
  // Environment
  env,
  isDevelopment,
  isProduction,
  isTest,

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },

  // SSL Configuration
  ssl: {
    enabled: process.env.SSL_ENABLED === 'true' || isProduction,
    keyPath: process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/odinpool.ai/privkey.pem',
    certPath: process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/odinpool.ai/fullchain.pem',
  },

  // CORS Configuration
  cors: {
    origins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : ['https://odinpool.ai', 'https://www.odinpool.ai'],
    credentials: true,
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE,
    ssl: isProduction 
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
    },
  },

  // Bitcoin RPC Configuration
  bitcoin: {
    network: process.env.BITCOIN_NETWORK || 'mainnet',
    rpcUser: process.env.BITCOIN_RPC_USER,
    rpcPassword: process.env.BITCOIN_RPC_PASSWORD,
    rpcHost: process.env.BITCOIN_RPC_HOST || '68.9.235.71',
    rpcPort: parseInt(process.env.BITCOIN_RPC_PORT || '8332', 10),
  },

  // Ord Server Configuration
  ord: {
    baseUrl: isDevelopment
      ? process.env.ORD_SERVER_URL || 'http://localhost:3000'
      : process.env.ORD_SERVER_URL || 'http://68.9.235.71:3000',
  },

  // External Services
  services: {
    localInstance: {
      baseUrl: process.env.LOCAL_INSTANCE_URL || 'http://143.198.17.64:3001',
    },
  },

  // API Keys
  apiKeys: {
    bestInSlot: process.env.BESTIN_SLOT_API_KEY,
    magicEden: process.env.MAGIC_EDEN_API_KEY,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    enableConsole: !isProduction,
  },

  // Security
  security: {
    bodyLimit: process.env.BODY_LIMIT || '10mb', // Reduced from 50mb
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};

// Validate required configuration
const requiredEnvVars = [
  'DATABASE_URL',
  'BITCOIN_RPC_USER',
  'BITCOIN_RPC_PASSWORD',
];

if (isProduction) {
  requiredEnvVars.push('SSL_KEY_PATH', 'SSL_CERT_PATH');
}

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  if (isProduction) {
    process.exit(1);
  }
}

export default config;
