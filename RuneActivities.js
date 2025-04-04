import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

// API Configuration
const API_CONFIG = {
  baseURL: 'https://api-mainnet.magiceden.dev/v2/ord/btc',
  headers: {
    "Authorization": "Bearer 0717815d-e286-4d15-bf7c-68b07901c858",
    "Accept": "application/json"
  },
  timeout: 10000
};

// API client setup
const api = axios.create(API_CONFIG);

// Database configuration
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create database pool
const pool = new pg.Pool(DB_CONFIG);

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const BATCH_SIZE = 100;
const CONCURRENT_REQUESTS = 5;

// Rate limiting
const limit = pLimit(CONCURRENT_REQUESTS);

/**
 * Helper function to delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse numeric values safely
 */
function parseNumericValue(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse amount values safely handling large numbers
 */
function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;

  try {
    // Remove any non-numeric characters except minus sign
    const cleanedValue = value.toString().replace(/[^0-9-]/g, '');

    // Return null for invalid values
    if (!cleanedValue || cleanedValue === '-') return null;

    // For large numbers, return as string without scientific notation
    const num = BigInt(cleanedValue);
    return num.toString(); // Return as string to preserve full precision

  } catch (error) {
    console.warn(`Failed to parse amount value: ${value}`, error);
    return null;
  }
}

/**
 * Retry mechanism for API calls
 */
async function withRetry(operation, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;

      const isRateLimit = error.response?.status === 429;
      const retryAfter = isRateLimit ?
        parseInt(error.response?.headers?.['retry-after']) * 1000 :
        RETRY_DELAY * Math.pow(2, i);

      console.warn(`Attempt ${i + 1} failed, retrying in ${retryAfter}ms...`, {
        error: error.message,
        status: error.response?.status
      });

      await delay(retryAfter);
    }
  }
}

/**
 * Fetch top rune tickers from API
 */
async function fetchRuneTickersFromAPI() {
  return withRetry(async () => {
    const params = {
      window: '1d',
      limit: 500,
      sort: 'volume',
      direction: 'desc'
    };

    console.log('Fetching rune tickers...');
    const response = await api.get('/runes/collection_stats/search', { params });

    if (!Array.isArray(response.data?.runes)) {
      throw new Error('Invalid API response format for runes');
    }

    const tickers = response.data.runes
      .map(r => r.rune)
      .filter(Boolean)
      .slice(0, 20);

    console.log(`Found ${tickers.length} rune tickers`);
    return tickers;
  });
}

/**
 * Fetch activities for a specific rune ticker
 */
async function fetchActivitiesForRuneTicker(runeTicker) {
  return withRetry(async () => {
    console.log(`Fetching activities for ${runeTicker}`);
    const response = await api.get(`/runes/activities/${runeTicker}`);

    // The response is an array directly, not nested under 'activities'
    const activities = Array.isArray(response.data) ? response.data : [];
    console.log(`Found ${activities.length} activities for ${runeTicker}`);

    return activities;
  });
}

/**
 * Prepare values for database insertion with proper type handling
 */
function prepareActivityValues(activity) {
  // Helper function to safely parse integers from strings
  const safeParseInt = (value) => {
    if (value === null || value === undefined) return null;
    // Handle string numbers without decimals
    const cleaned = value.toString().trim();
    if (!cleaned) return null;
    const parsed = parseInt(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  // Helper function to safely parse floats from strings
  const safeParseFloat = (value) => {
    if (value === null || value === undefined) return null;
    // Handle string numbers with potential decimals
    const cleaned = value.toString().trim();
    if (!cleaned) return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  // Special handling for amount values which can be very large
  const parseAmount = (value) => {
    if (value === null || value === undefined) return null;
    try {
      // Remove any quotes and trim
      const cleaned = value.toString().trim().replace(/['"]/g, '');
      if (!cleaned) return null;

      // Handle scientific notation if present
      if (cleaned.includes('e')) {
        return BigInt(cleaned).toString();
      }

      // Return the cleaned string for large numbers
      // This preserves exact precision for large values
      return cleaned.replace(/[^0-9-]/g, '');
    } catch (error) {
      console.warn(`Failed to parse amount value: ${value}`, error);
      return null;
    }
  };

  // Parse the values with proper handling for the exact format we're seeing
  const parsedValues = [
    activity.id,                                    // String UUID
    activity.kind,                                  // String enum
    activity.oldOwner,                             // String address
    activity.newOwner,                             // Can be null
    activity.address,                              // String address
    activity.rune,                                 // String ticker
    parseAmount(activity.amount),                  // String number
    activity.txValue,                              // Can be null
    activity.txId,                                 // Can be null
    activity.txVout,                               // Can be null
    activity.txBlockTime,                          // Can be null
    activity.txBlockHeight,                        // Can be null
    activity.txBlockHash,                          // Can be null
    activity.mempoolTxId,                          // Can be null
    activity.deletedAt,                            // Can be null
    activity.createdAt,                            // String timestamp
    safeParseInt(activity.listedPrice),            // String number
    activity.listedMakerFeeBp,                     // Number or null
    activity.listedTakerFeeBp,                     // Can be null
    safeParseFloat(activity.btcUsdPrice),          // String float
    activity.sellerPaymentReceiverAddress,         // String address
    activity.buyerPaymentAddress,                  // Can be null
    activity.listingWalletSource,                  // String enum
    activity.walletSource,                         // Can be null
    activity.isRbfProtectionBuyBroadcast           // Can be null
  ];

  // Log the parsed values for debugging
  console.log(`Processing activity ${activity.id}:`);
  console.log(`- Amount: ${parsedValues[6]} (original: ${activity.amount})`);
  console.log(`- Listed Price: ${parsedValues[16]} (original: ${activity.listedPrice})`);
  console.log(`- BTC USD Price: ${parsedValues[19]} (original: ${activity.btcUsdPrice})`);

  return parsedValues;
}

/**
 * Modified insertRuneActivitiesToDB function with updated INSERT query
 */
async function insertRuneActivitiesToDB(runeTicker, activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    console.log(`No activities found for rune: ${runeTicker}`);
    return;
  }

  const client = await pool.connect();
  const txTimestamp = new Date().toISOString();

  try {
    await client.query('BEGIN');

    // Mark existing records as processed
    await client.query(`
      UPDATE rune_activities_details
      SET processed_at = $1
      WHERE rune_ticker = $2 AND processed_at IS NULL
    `, [txTimestamp, runeTicker]);

    // Process activities in batches
    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      const batch = activities.slice(i, i + BATCH_SIZE);

      const insertQuery = `
        INSERT INTO rune_activities_details (
          id, kind, old_owner, new_owner, address, rune_ticker,
          amount, tx_value, tx_id, tx_vout, tx_block_time,
          tx_block_height, tx_block_hash, mempool_tx_id, deleted_at,
          created_at, listed_price, listed_maker_fee_bp,
          listed_taker_fee_bp, btc_usd_price,
          seller_payment_receiver_address, buyer_payment_address,
          listing_wallet_source, wallet_source,
          is_rbf_protection_buy_broadcast, processed_at
        ) VALUES ${batch.map((_, idx) =>
          `(${Array(26).fill(0).map((_, j) => `$${idx * 26 + j + 1}`).join(',')})`
        ).join(',')}
        ON CONFLICT (id) DO UPDATE SET
          kind = EXCLUDED.kind,
          old_owner = EXCLUDED.old_owner,
          new_owner = EXCLUDED.new_owner,
          address = EXCLUDED.address,
          rune_ticker = EXCLUDED.rune_ticker,
          amount = EXCLUDED.amount,
          tx_value = EXCLUDED.tx_value,
          tx_id = EXCLUDED.tx_id,
          tx_vout = EXCLUDED.tx_vout,
          tx_block_time = EXCLUDED.tx_block_time,
          tx_block_height = EXCLUDED.tx_block_height,
          tx_block_hash = EXCLUDED.tx_block_hash,
          mempool_tx_id = EXCLUDED.mempool_tx_id,
          deleted_at = EXCLUDED.deleted_at,
          created_at = EXCLUDED.created_at,
          listed_price = EXCLUDED.listed_price,
          listed_maker_fee_bp = EXCLUDED.listed_maker_fee_bp,
          listed_taker_fee_bp = EXCLUDED.listed_taker_fee_bp,
          btc_usd_price = EXCLUDED.btc_usd_price,
          seller_payment_receiver_address = EXCLUDED.seller_payment_receiver_address,
          buyer_payment_address = EXCLUDED.buyer_payment_address,
          listing_wallet_source = EXCLUDED.listing_wallet_source,
          wallet_source = EXCLUDED.wallet_source,
          is_rbf_protection_buy_broadcast = EXCLUDED.is_rbf_protection_buy_broadcast,
          processed_at = EXCLUDED.processed_at
      `;

      const values = batch.flatMap(activity => [
        ...prepareActivityValues(activity),
        txTimestamp // processed_at
      ]);

      await client.query(insertQuery, values);
    }

    await client.query('COMMIT');
    console.log(`Successfully processed ${activities.length} activities for ${runeTicker}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Database error for ${runeTicker}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main function to update rune activities
 */
async function updateRunesActivities() {
  console.log(`[${new Date().toISOString()}] Starting runes activities update`);

  try {
    const runeTickers = await fetchRuneTickersFromAPI();

    if (runeTickers.length === 0) {
      console.log('No runes found to process');
      return;
    }

    const results = await Promise.allSettled(
      runeTickers.map(ticker =>
        limit(async () => {
          try {
            const activities = await fetchActivitiesForRuneTicker(ticker);
            await insertRuneActivitiesToDB(ticker, activities);
            return { ticker, status: 'success', count: activities.length };
          } catch (error) {
            console.error(`Error processing ${ticker}:`, error);
            return { ticker, status: 'error', error: error.message };
          }
        })
      )
    );

    // Generate summary
    const successful = results.filter(r => r.value?.status === 'success');
    const failed = results.filter(r => r.value?.status === 'error');

    console.log(`
Update Summary:
- Total runes processed: ${results.length}
- Successfully processed: ${successful.length}
- Failed: ${failed.length}
${failed.length > 0 ? '\nFailed runes:' : ''}
${failed.map(f => `- ${f.value.ticker}: ${f.value.error}`).join('\n')}
    `);
  } catch (error) {
    console.error('[FATAL ERROR] Failed to update runes activities:', error);
    throw error;
  }
}

// Error handler for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

export { updateRunesActivities };