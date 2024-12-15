// runesWallet.js

import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const limit = pLimit(10);

// Ensure there's a checkpoint table
async function ensureCheckpointTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS rune_wallet_process_checkpoints (
      wallet_addr VARCHAR(255) PRIMARY KEY,
      last_processed_count INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function saveWalletCheckpoint(client, walletAddr, processedCount) {
  await client.query(`
    INSERT INTO rune_wallet_process_checkpoints (wallet_addr, last_processed_count)
    VALUES ($1, $2)
    ON CONFLICT (wallet_addr)
    DO UPDATE SET
      last_processed_count = $2,
      updated_at = CURRENT_TIMESTAMP
  `, [walletAddr, processedCount]);
}

async function loadWalletCheckpoint(client, walletAddr) {
  const result = await client.query(`
    SELECT last_processed_count
    FROM rune_wallet_process_checkpoints
    WHERE wallet_addr = $1
  `, [walletAddr]);
  return {
    processedCount: result.rows[0]?.last_processed_count || 0
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch wallet activities from the Magic Eden endpoint.
 * This replaces the original BestInSlot API calls.
 */
async function fetchWalletActivities(walletAddr) {
  const url = `https://api-mainnet.magiceden.dev/v2/ord/btc/runes/wallet/activities/${walletAddr}`;

  const headers = {
    "Authorization": "Bearer 0717815d-e286-4d15-bf7c-68b07901c858",
    "Accept": "application/json"
  };

  console.log(`Fetching wallet activities from ${url}`);

  try {
    const response = await axios.get(url, { headers });
    // Assume response.data is an array of activities
    if (Array.isArray(response.data)) {
      console.log(`Fetched ${response.data.length} activities for wallet ${walletAddr}`);
      return response.data;
    } else {
      console.warn(`Unexpected response format for wallet ${walletAddr}`);
      return [];
    }
  } catch (error) {
    console.error('Error fetching wallet activities:', error);
    throw error;
  }
}

/**
 * Insert wallet activities into database.
 * Adjust the query based on the actual data structure returned by the Magic Eden API.
 * The following is just an example and likely needs customization.
 */

async function insertWalletActivitiesBatch(client, activities, walletAddr) {
  if (!activities.length) return;

  if (process.listenerCount('SIGINT') >= 10) {
    console.warn('Too many SIGINT listeners detected, cleaning up...');
    process.removeAllListeners('SIGINT');
  }

  const cleanup = async () => {
    console.log(`[${new Date().toISOString()}] Received SIGINT - completing current batch before shutdown`);
    try {
      await client.query('COMMIT');
      process.removeListener('SIGINT', cleanup);
      process.exit(0);
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  };

  try {
    await client.query('BEGIN');
    process.once('SIGINT', cleanup);

    const insertQuery = `
      INSERT INTO rune_wallet_activities (
        id,
        rune,
        kind,
        address,
        newOwner,
        txId,
        txBlockTime,
        txBlockHeight,
        txBlockHash,
        mempoolTxId,
        amount,
        formattedAmount,
        createdAt,
        btcUsdPrice,
        spacedRune
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    for (const activity of activities) {
      const {
        id,
        rune,
        kind,
        address,
        newOwner,
        txId,
        txBlockTime,
        txBlockHeight,
        txBlockHash,
        mempoolTxId,
        amount,
        formattedAmount,
        createdAt,
        btcUsdPrice,
        spacedRune
      } = activity;

      await client.query(insertQuery, [
        id,
        rune,
        kind,
        address,
        newOwner,       // Fixed: matches the API key
        txId,
        txBlockTime,
        txBlockHeight,
        txBlockHash,
        mempoolTxId,
        amount,
        formattedAmount,
        createdAt,
        btcUsdPrice,
        spacedRune
      ]);
    }

    await client.query('COMMIT');
    process.removeListener('SIGINT', cleanup);
    console.log(`[${new Date().toISOString()}] Processed batch: ${activities.length} activities`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Batch error:`, error);
    await client.query('ROLLBACK');
    process.removeListener('SIGINT', cleanup);
    throw error;
  }
}

async function updateWalletActivities(walletAddr) {
  const client = await pool.connect();

  try {
    console.log(`[${new Date().toISOString()}] Starting wallet activities update for ${walletAddr}`);

    await ensureCheckpointTable(client);
    const { processedCount } = await loadWalletCheckpoint(client, walletAddr);
    console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount} activities processed`);

    // Fetch all wallet activities (this endpoint may not support paging)
    const activities = await fetchWalletActivities(walletAddr);

    // If we had checkpoints and partial updates, we could filter out already-processed entries here.
    // For demonstration, assume we process all fetched activities.
    await insertWalletActivitiesBatch(client, activities, walletAddr);

    // Save checkpoint (in this scenario, we might just set processedCount to the length of fetched activities)
    await saveWalletCheckpoint(client, walletAddr, activities.length);

    console.log(`[${new Date().toISOString()}] Completed update for wallet ${walletAddr}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating wallet activities:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export {
  fetchWalletActivities,
  insertWalletActivitiesBatch,
  updateWalletActivities
};
