// runes.js

import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const limit = pLimit(10); // Limit concurrent API calls

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRuneHoldersFromAPI(runeName) {
  const urlBase = "https://api.bestinslot.xyz/v3/runes/holders";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };
  const holders = [];
  const batchSize = 500;  // Maximum allowed by API
  const delayBetweenRequests = 8000; // 8 second delay between requests

  try {
    let hasMore = true;
    let offset = 0;

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
    return [];
  }
}

async function insertRuneHoldersToDB(holders) {
  if (!Array.isArray(holders)) {
    console.error('Error: Holders is not an array');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting transaction');

    // First, mark all existing records as not current
    await client.query(`
      UPDATE rune_holders
      SET created_at = CURRENT_TIMESTAMP
      WHERE rune_id = $1
    `, [holders[0]?.rune_id]); // Using the first holder's rune_id as reference

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
    console.log(`Successfully inserted/updated ${holders.length} rune holders`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting rune holder data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateRuneHolders(runeName) {
  try {
    console.log(`[${new Date().toISOString()}] Starting rune holders update for ${runeName}`);

    const holders = await fetchRuneHoldersFromAPI(runeName);

    if (holders.length > 0) {
      await insertRuneHoldersToDB(holders);
      console.log(`[${new Date().toISOString()}] Completed update for ${runeName} with ${holders.length} holders`);
    } else {
      console.log(`[${new Date().toISOString()}] No holders found for ${runeName}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating rune holders:`, error);
    throw error;
  }
}

export {
  fetchRuneHoldersFromAPI,
  insertRuneHoldersToDB,
  updateRuneHolders
};