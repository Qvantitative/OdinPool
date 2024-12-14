// RunesActivity.js

import pg from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

const limit = pLimit(10);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumericValue(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

function getOutpoint(activity) {
  if (activity.event_type === 'burn') {
    return `${activity.txid}:burn`;
  }
  return activity.outpoint;
}

async function fetchRuneActivityFromAPI(runeName) {
  if (!runeName) {
    throw new Error('runeName is required for fetching rune activity');
  }

  const url = "https://api.bestinslot.xyz/v3/runes/activity";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };

  const params = {
    rune_name: runeName,
    sort_by: 'ts',
    order: 'desc',
    offset: 0,
    count: 2000,
  };

  try {
    console.log(`Fetching rune activity from ${url} for ${runeName}`);
    const response = await axios.get(url, { headers, params });

    if (Array.isArray(response.data.data)) {
      return response.data.data;
    } else {
      console.warn(`Unexpected response format for ${runeName}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching rune activity data for ${runeName}:`, error);
    if (error.response?.data) {
      console.error('API Error details:', error.response.data);
    }
    return [];
  }
}

async function insertRuneActivityToDB(activities, runeName) {
  if (!Array.isArray(activities) || activities.length === 0) {
    console.error(`Error: No valid activity data to insert for ${runeName}`);
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log(`Starting transaction for ${runeName} activity insertion`);

    const insertQuery = `
      INSERT INTO runes_activity (
        event_type,
        txid,
        outpoint,
        pkscript,
        wallet_addr,
        rune_id,
        amount,
        block_height,
        block_timestamp,
        rune_name,
        spaced_rune_name,
        decimals,
        sale_price,
        sold_to_pkscript,
        sold_to_wallet_addr,
        marketplace
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (txid, outpoint) DO NOTHING
      RETURNING id;`;

    let successCount = 0;
    let skipCount = 0;

    for (const activity of activities) {
      const {
        event_type,
        txid,
        pkscript,
        wallet_addr,
        rune_id,
        amount,
        block_height,
        block_timestamp,
        rune_name,
        spaced_rune_name,
        decimals,
        sale_info
      } = activity;

      const outpoint = getOutpoint(activity);

      if (!txid || !outpoint) {
        console.warn(`Skipping ${runeName} activity due to missing required fields:`, {
          txid,
          outpoint,
          event_type
        });
        skipCount++;
        continue;
      }

      const sale_price = sale_info?.sale_price || null;
      const sold_to_pkscript = sale_info?.sold_to_pkscript || null;
      const sold_to_wallet_addr = sale_info?.sold_to_wallet_addr || null;
      const marketplace = sale_info?.marketplace || null;

      const values = [
        event_type,
        txid,
        outpoint,
        pkscript || null,
        wallet_addr || null,
        rune_id || null,
        parseNumericValue(amount),
        parseInt(block_height) || null,
        block_timestamp ? new Date(block_timestamp) : null,
        rune_name || null,
        spaced_rune_name || null,
        parseInt(decimals) || null,
        parseNumericValue(sale_price),
        sold_to_pkscript,
        sold_to_wallet_addr,
        marketplace
      ];

      try {
        const result = await client.query(insertQuery, values);
        if (result.rowCount > 0) {
          successCount++;
          console.log(`Successfully inserted ${runeName} ${event_type} activity:`, {
            txid,
            outpoint,
            event_type
          });
        }
      } catch (error) {
        console.error(`Error inserting ${runeName} activity:`, {
          txid,
          outpoint,
          event_type,
          error: error.message
        });
        throw error;
      }
    }

    await client.query('COMMIT');
    console.log(`Processing complete for ${runeName}:`);
    console.log(`- Inserted: ${successCount}`);
    console.log(`- Skipped: ${skipCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error inserting rune activity data for ${runeName}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateRuneActivity(runeName) {
  if (!runeName) {
    throw new Error('runeName is required for updating rune activity');
  }

  try {
    console.log(`[${new Date().toISOString()}] Starting rune activity update for ${runeName}`);

    const activities = await fetchRuneActivityFromAPI(runeName);

    if (activities.length > 0) {
      await insertRuneActivityToDB(activities, runeName);
      console.log(`[${new Date().toISOString()}] Completed activity update for ${runeName}`);
    } else {
      console.log(`[${new Date().toISOString()}] No activity found for ${runeName}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating rune activity for ${runeName}:`, error);
    throw error;
  }
}

export {
  fetchRuneActivityFromAPI,
  insertRuneActivityToDB,
  updateRuneActivity
};};