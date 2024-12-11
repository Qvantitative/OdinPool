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

// Helper function to parse numeric values safely
function parseNumericValue(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

async function fetchRuneActivityFromAPI() {
  const url = "https://api.bestinslot.xyz/v3/runes/activity";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };

  // Example parameters based on the image and instructions:
  // rune_name=DOGGOTOTHEMOON
  // sort_by=ts (timestamp)
  // order=desc
  // offset=0
  // count=200
  const params = {
    rune_name: 'DOGGOTOTHEMOON',
    sort_by: 'ts',
    order: 'desc',
    offset: 0,
    count: 200,
  };

  try {
    console.log(`Fetching rune activity from ${url} for DOGGOTOTHEMOON`);
    const response = await axios.get(url, { headers, params });

    if (Array.isArray(response.data.data)) {
      return response.data.data;
    } else {
      console.warn('Unexpected response format');
      return [];
    }
  } catch (error) {
    console.error('Error fetching rune activity data:', error);
    if (error.response?.data) {
      console.error('API Error details:', error.response.data);
    }
    return [];
  }
}

async function insertRuneActivityToDB(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    console.error('Error: No valid activity data to insert');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting transaction for rune activity insertion');

    // Example table schema (adjust as needed):
    // CREATE TABLE runes_activity (
    //   id SERIAL PRIMARY KEY,
    //   event_type TEXT,
    //   txid TEXT,
    //   outpoint TEXT,
    //   pkscript TEXT,
    //   wallet_addr TEXT,
    //   rune_id TEXT,
    //   amount NUMERIC,
    //   block_height INT,
    //   block_timestamp TIMESTAMP,
    //   rune_name TEXT,
    //   spaced_rune_name TEXT,
    //   decimals INT,
    //   sale_price NUMERIC,
    //   sold_to_pkscript TEXT,
    //   sold_to_wallet_addr TEXT,
    //   marketplace TEXT,
    //   created_at TIMESTAMP DEFAULT NOW()
    // );

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
      ON CONFLICT (txid, outpoint) DO NOTHING;
    `;

    for (const activity of activities) {
      // Extracting fields from the returned JSON.
      const {
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
        sale_info
      } = activity;

      // sale_info might be null or contain additional fields.
      const sale_price = sale_info?.sale_price || null;
      const sold_to_pkscript = sale_info?.sold_to_pkscript || null;
      const sold_to_wallet_addr = sale_info?.sold_to_wallet_addr || null;
      const marketplace = sale_info?.marketplace || null;

      const values = [
        event_type,
        txid,
        outpoint,
        pkscript,
        wallet_addr,
        rune_id,
        parseNumericValue(amount),
        parseInt(block_height) || null,
        block_timestamp ? new Date(block_timestamp) : null,
        rune_name,
        spaced_rune_name,
        parseInt(decimals) || null,
        parseNumericValue(sale_price),
        sold_to_pkscript,
        sold_to_wallet_addr,
        marketplace
      ];

      console.log('Inserting activity:', values);
      await client.query(insertQuery, values);
    }

    await client.query('COMMIT');
    console.log(`Successfully inserted/updated ${activities.length} rune activity records`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting rune activity data:', error);
    if (error.response?.data) {
      console.error('API Error details:', error.response.data);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateRuneActivity() {
  try {
    console.log(`[${new Date().toISOString()}] Starting rune activity update for DOGGOTOTHEMOON`);

    const activities = await fetchRuneActivityFromAPI();

    if (activities.length > 0) {
      await insertRuneActivityToDB(activities);
      console.log(`[${new Date().toISOString()}] Completed activity update with ${activities.length} records`);
    } else {
      console.log(`[${new Date().toISOString()}] No activity found`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating rune activity:`, error);
    throw error;
  }
}

export {
  fetchRuneActivityFromAPI,
  insertRuneActivityToDB,
  updateRuneActivity
};