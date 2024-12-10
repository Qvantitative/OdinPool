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

// Helper function to adjust batch size to ensure offsets align with API requirements
function adjustBatchSize(currentOffset, desiredBatchSize) {
  // If the current offset isn't a multiple of 20, adjust the batch size
  // to make the next offset land on a multiple of 20
  const nextOffset = currentOffset + desiredBatchSize;
  const nextMultipleOf20 = Math.ceil(nextOffset / 20) * 20;
  return nextMultipleOf20 - currentOffset;
}

async function fetchRuneHoldersBatch(runeName, offset, desiredBatchSize) {
  const urlBase = "https://api.bestinslot.xyz/v3/runes/holders";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    // Adjust batch size to ensure next offset will be a multiple of 20
    const adjustedBatchSize = adjustBatchSize(offset, desiredBatchSize);

    const url = `${urlBase}?rune_name=${runeName}&sort_by=balance&order=desc&count=${adjustedBatchSize}&offset=${offset}`;
    console.log(`Fetching from ${url}`);

    const response = await axios.get(url, { headers });

    if (Array.isArray(response.data.data)) {
      console.log(`Fetched ${response.data.data.length} holders at offset ${offset}`);
      return {
        holders: response.data.data,
        nextOffset: offset + response.data.data.length
      };
    } else {
      console.warn(`Unexpected response format at offset ${offset}`);
      return { holders: [], nextOffset: offset };
    }
  } catch (error) {
    console.error('Error fetching rune holders batch:', error);
    throw error;
  }
}

async function insertRuneHoldersBatch(client, holders, runeName) {
  if (!holders.length) return;

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
  const DESIRED_BATCH_SIZE = 500;

  try {
    console.log(`[${new Date().toISOString()}] Starting rune holders update for ${runeName}`);

    await ensureCheckpointTable(client);
    const { processedCount } = await loadRuneCheckpoint(client, runeName);
    console.log(`[${new Date().toISOString()}] Resuming from checkpoint: ${processedCount} holders processed`);

    let offset = processedCount;
    let hasMore = true;
    let totalProcessed = processedCount;

    while (hasMore) {
      if (offset > processedCount) {
        await delay(8000);
      }

      const { holders: batchHolders, nextOffset } = await fetchRuneHoldersBatch(runeName, offset, DESIRED_BATCH_SIZE);

      if (batchHolders.length === 0) {
        hasMore = false;
        continue;
      }

      await insertRuneHoldersBatch(client, batchHolders, runeName);

      offset = nextOffset;
      totalProcessed += batchHolders.length;
      await saveRuneCheckpoint(client, runeName, totalProcessed, totalProcessed);
      console.log(`[${new Date().toISOString()}] Checkpoint saved at: ${totalProcessed} holders`);

      if (batchHolders.length < DESIRED_BATCH_SIZE) {
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