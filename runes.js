// runes.js

import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const limit = pLimit(10);

async function ensureCheckpointTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS rune_process_checkpoints (
      rune_name VARCHAR(255) PRIMARY KEY,
      last_processed_count INTEGER,
      total_holders INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function saveRuneCheckpoint(client, runeName, processedCount, totalHolders) {
  await client.query(`
    INSERT INTO rune_process_checkpoints (rune_name, last_processed_count, total_holders)
    VALUES ($1, $2, $3)
    ON CONFLICT (rune_name)
    DO UPDATE SET
      last_processed_count = $2,
      total_holders = $3,
      updated_at = CURRENT_TIMESTAMP
  `, [runeName, processedCount, totalHolders]);
}

async function loadRuneCheckpoint(client, runeName) {
  const result = await client.query(`
    SELECT last_processed_count, total_holders
    FROM rune_process_checkpoints
    WHERE rune_name = $1
  `, [runeName]);
  return {
    processedCount: result.rows[0]?.last_processed_count || 0,
    totalHolders: result.rows[0]?.total_holders || 0
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRuneHoldersBatch(runeName, offset, batchSize) {
  const urlBase = "https://api.bestinslot.xyz/v3/runes/holders";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    const url = `${urlBase}?rune_name=${runeName}&sort_by=balance&order=desc&count=${batchSize}&offset=${offset}`;
    console.log(`Fetching from ${url}`);

    const response = await axios.get(url, { headers });

    if (Array.isArray(response.data.data)) {
      console.log(`Fetched ${response.data.data.length} holders at offset ${offset}`);
      return response.data.data;
    } else {
      console.warn(`Unexpected response format at offset ${offset}`);
      return [];
    }
  } catch (error) {
    console.error('Error fetching rune holders batch:', error);
    throw error;
  }
}

async function insertRuneHoldersBatch(client, holders, runeName) {
  if (!holders.length) return;

  // Check current listener count
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

    // Update timestamps for existing records
    if (holders[0]?.rune_id) {
      await client.query(`
        UPDATE rune_holders
        SET created_at = CURRENT_TIMESTAMP
        WHERE rune_id = $1
      `, [holders[0].rune_id]);
    }

    const insertQuery = `
      INSERT INTO rune_holders (
        pkscript,
        wallet_addr,
        rune_id,
        total_balance,
        rune_name,
        spaced_rune_name,
        decimals
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (wallet_addr, rune_id)
      DO UPDATE SET
        total_balance = EXCLUDED.total_balance,
        created_at = CURRENT_TIMESTAMP;
    `;

    for (const holder of holders) {
      await client.query(insertQuery, [
        holder.pkscript,
        holder.wallet_addr,
        holder.rune_id,
        holder.total_balance,
        holder.rune_name,
        holder.spaced_rune_name,
        holder.decimals
      ]);
    }

    await client.query('COMMIT');
    process.removeListener('SIGINT', cleanup);
    console.log(`[${new Date().toISOString()}] Processed batch: ${holders.length} holders`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Batch error:`, error);
    await client.query('ROLLBACK');
    process.removeListener('SIGINT', cleanup);
    throw error;
  }
}

async function updateRuneHolders(runeName) {
  const client = await pool.connect();
  const BATCH_SIZE = 500;

  try {
    console.log(`[${new Date().toISOString()}] Starting rune holders update for ${runeName}`);

    await ensureCheckpointTable(client);
    const { processedCount } = await loadRuneCheckpoint(client, runeName);
    console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount} holders processed`);

    let offset = processedCount;
    let hasMore = true;
    let totalProcessed = processedCount;

    while (hasMore) {
      // Add delay between batches to respect rate limits
      if (offset > processedCount) {
        await delay(8000);
      }

      // Fetch and process one batch
      const batchHolders = await fetchRuneHoldersBatch(runeName, offset, BATCH_SIZE);

      if (batchHolders.length === 0) {
        hasMore = false;
        continue;
      }

      // Process this batch
      await insertRuneHoldersBatch(client, batchHolders, runeName);

      // Update offset and save checkpoint
      offset += batchHolders.length;
      totalProcessed += batchHolders.length;
      await saveRuneCheckpoint(client, runeName, offset, totalProcessed);
      console.log(`[${new Date().toISOString()}] Checkpoint saved at: ${offset} holders`);

      if (batchHolders.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    console.log(`[${new Date().toISOString()}] Completed update for ${runeName} with ${totalProcessed} total holders`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating rune holders:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export {
  fetchRuneHoldersBatch,
  insertRuneHoldersBatch,
  updateRuneHolders
};