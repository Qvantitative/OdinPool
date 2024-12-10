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

// Add checkpoint table if it doesn't exist
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

// Save checkpoint
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

// Load checkpoint
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

async function fetchRuneHoldersFromAPI(runeName, startOffset = 0) {
  const urlBase = "https://api.bestinslot.xyz/v3/runes/holders";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };
  const holders = [];
  const batchSize = 500;
  const delayBetweenRequests = 8000;

  try {
    let hasMore = true;
    let offset = startOffset;

    while (hasMore) {
      const url = `${urlBase}?rune_name=${runeName}&sort_by=balance&order=desc&count=${batchSize}&offset=${offset}`;
      console.log(`Fetching from ${url}`);

      const response = await axios.get(url, { headers });

      if (Array.isArray(response.data.data)) {
        if (response.data.data.length === 0) {
          hasMore = false;
          continue;
        }

        holders.push(...response.data.data);
        console.log(`Fetched ${holders.length} holders so far`);

        if (response.data.data.length < batchSize) {
          hasMore = false;
        }
      } else {
        console.warn(`Unexpected response format at offset ${offset}`);
        hasMore = false;
      }

      offset += batchSize;
      await delay(delayBetweenRequests);
    }

    return holders;
  } catch (error) {
    console.error('Error fetching rune holders data:', error);
    throw error; // Propagate error to handle retry logic in caller
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

    // Ensure checkpoint table exists
    await ensureCheckpointTable(client);

    // Load last checkpoint
    const { processedCount, totalHolders } = await loadRuneCheckpoint(client, runeName);
    console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount} holders processed`);

    // Fetch holders starting from checkpoint
    let holders = [];
    try {
      holders = await fetchRuneHoldersFromAPI(runeName, processedCount);
    } catch (error) {
      console.error(`Error fetching holders, will retry from last checkpoint next time:`, error);
      throw error;
    }

    if (holders.length > 0) {
      // Process in batches
      for (let i = 0; i < holders.length; i += BATCH_SIZE) {
        const batch = holders.slice(i, i + BATCH_SIZE);
        await insertRuneHoldersBatch(client, batch, runeName);

        // Save checkpoint after each batch
        const currentProcessed = processedCount + i + batch.length;
        await saveRuneCheckpoint(client, runeName, currentProcessed, holders.length);
        console.log(`[${new Date().toISOString()}] Checkpoint saved at: ${currentProcessed} holders`);
      }

      console.log(`[${new Date().toISOString()}] Completed update for ${runeName} with ${holders.length} holders`);
    } else {
      console.log(`[${new Date().toISOString()}] No holders found for ${runeName}`);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating rune holders:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export {
  fetchRuneHoldersFromAPI,
  updateRuneHolders
};