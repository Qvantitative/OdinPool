import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const limit = pLimit(10);

// Add headers for both requests
const headers = {
  "Authorization": "Bearer 0717815d-e286-4d15-bf7c-68b07901c858",
  "Accept": "application/json"
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumericValue(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

async function fetchRuneTickersFromAPI() {
  const url = `https://api-mainnet.magiceden.dev/v2/ord/btc/runes/collection_stats/search?window=1d&limit=500&sort=volume&direction=desc`;

  try {
    console.log(`Fetching runes from ${url}`);
    const response = await axios.get(url, { headers });

    if (Array.isArray(response.data.runes)) {
      // Extract runes sorted by volume
      const allTickers = response.data.runes.map(r => r.rune).filter(Boolean);

      // Take only top 20
      const top20Tickers = allTickers.slice(0, 20);
      return top20Tickers;
    } else {
      console.warn('Unexpected response format for runes');
      return [];
    }
  } catch (error) {
    console.error('Error fetching runes tickers data:', error);
    if (error.response?.data) {
      console.error('API Error details:', error.response.data);
    }
    return [];
  }
}

async function fetchActivitiesForRuneTicker(runeTicker) {
  const url = `https://api-mainnet.magiceden.dev/v2/ord/btc/runes/activities/${runeTicker}`;
  try {
    const response = await axios.get(url, { headers });
    // The structure of activities might be different than collection_stats.
    // Inspect response.data to adapt the insertion logic.
    return response.data.activities || [];
  } catch (error) {
    console.error(`Error fetching activities for ${runeTicker}:`, error);
    if (error.response?.data) {
      console.error('API Error details:', error.response.data);
    }
    return [];
  }
}

async function insertRuneActivitiesToDB(runeTicker, activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    console.log(`No activities found for rune: ${runeTicker}`);
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log(`Starting transaction for inserting activities of rune: ${runeTicker}`);

    // Example INSERT query. Adjust the table and column names to match your schema.
    // Also ensure 'id' is primary key or unique, so ON CONFLICT works.
    const insertQuery = `
      INSERT INTO rune_activities_details (
        id,
        kind,
        old_owner,
        new_owner,
        address,
        rune_ticker,
        amount,
        tx_value,
        tx_id,
        tx_vout,
        tx_block_time,
        tx_block_height,
        tx_block_hash,
        mempool_tx_id,
        deleted_at,
        created_at,
        listed_price,
        listed_maker_fee_bp,
        listed_taker_fee_bp,
        btc_usd_price,
        seller_payment_receiver_address,
        buyer_payment_address,
        listing_wallet_source,
        wallet_source,
        is_rbf_protection_buy_broadcast
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      )
      ON CONFLICT (id)
      DO UPDATE SET
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
        is_rbf_protection_buy_broadcast = EXCLUDED.is_rbf_protection_buy_broadcast
    ;`;

    let successCount = 0;

    for (const activity of activities) {
      const {
        id,
        kind,
        oldOwner,
        newOwner,
        address,
        rune,
        amount,
        txValue,
        txId,
        txVout,
        txBlockTime,
        txBlockHeight,
        txBlockHash,
        mempoolTxId,
        deletedAt,
        createdAt,
        listedPrice,
        listedMakerFeeBp,
        listedTakerFeeBp,
        btcUsdPrice,
        sellerPaymentReceiverAddress,
        buyerPaymentAddress,
        listingWalletSource,
        walletSource,
        isRbfProtectionBuyBroadcast
      } = activity;

      // Parse numeric values where needed
      // For timestamps, if `txBlockTime` can be a numeric timestamp, you could use to_timestamp in SQL.
      // If it is ISO format or null, just insert directly.
      // The same applies to `deletedAt` and `createdAt`; if they are ISO strings, Postgres can handle them as timestamps.
      const values = [
        id,
        kind,
        oldOwner,
        newOwner,
        address,
        rune,
        amount ? parseInt(amount) : null,
        txValue ? parseInt(txValue) : null,
        txId,
        txVout !== undefined ? parseInt(txVout) : null,
        txBlockTime, // if null or a valid timestamp string. If numeric, consider using to_timestamp in the query.
        txBlockHeight !== undefined ? parseInt(txBlockHeight) : null,
        txBlockHash,
        mempoolTxId,
        deletedAt,   // if null or an ISO timestamp, PG will accept it for a TIMESTAMP column
        createdAt,    // same as above
        listedPrice ? parseInt(listedPrice) : null,
        listedMakerFeeBp !== undefined ? parseInt(listedMakerFeeBp) : null,
        listedTakerFeeBp !== undefined ? parseInt(listedTakerFeeBp) : null,
        btcUsdPrice ? parseFloat(btcUsdPrice) : null,
        sellerPaymentReceiverAddress,
        buyerPaymentAddress,
        listingWalletSource,
        walletSource,
        isRbfProtectionBuyBroadcast === true || isRbfProtectionBuyBroadcast === false ? isRbfProtectionBuyBroadcast : null
      ];

      try {
        const result = await client.query(insertQuery, values);
        if (result.rowCount > 0) {
          successCount++;
        }
      } catch (error) {
        console.error(`Error inserting activity for ${runeTicker}:`, { error: error.message });
        throw error;
      }
    }

    await client.query('COMMIT');
    console.log(`Inserted/Updated ${successCount} activities for ${runeTicker}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting rune activities data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateRunesActivities() {
  try {
    console.log(`[${new Date().toISOString()}] Starting runes activities update`);

    // Fetch all rune tickers first
    const runeTickers = await fetchRuneTickersFromAPI();

    if (runeTickers.length === 0) {
      console.log(`[${new Date().toISOString()}] No runes found`);
      return;
    }

    // For each ticker, fetch its activities
    await Promise.all(
      runeTickers.map(ticker =>
        limit(async () => {
          const activities = await fetchActivitiesForRuneTicker(ticker);
          await insertRuneActivitiesToDB(ticker, activities);
        })
      )
    );

    console.log(`[${new Date().toISOString()}] Completed activities update for all runes`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating runes activities:`, error);
    throw error;
  }
}

export {
  updateRunesActivities
};
