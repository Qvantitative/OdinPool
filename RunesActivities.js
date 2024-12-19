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
  try {
    // Convert to string first to handle large numbers
    const stringValue = value.toString();
    // Remove any commas if present
    const cleanValue = stringValue.replace(/,/g, '');
    // Check if it's a valid number
    if (!isNaN(cleanValue) && isFinite(cleanValue)) {
      // Return as string to preserve precision
      return cleanValue;
    }
    return null;
  } catch (error) {
    console.warn(`Error parsing numeric value: ${value}`, error);
    return null;
  }
}

async function fetchRunesActivitiesFromAPI() {
  const url = `https://api-mainnet.magiceden.dev/v2/ord/btc/runes/collection_stats/search?window=1d&limit=500&sort=volume&direction=desc`;

  const headers = {
    "Authorization": "Bearer 0717815d-e286-4d15-bf7c-68b07901c858",
    "Accept": "application/json"
  };

  try {
    console.log(`Fetching runes activities from ${url}`);
    const response = await axios.get(url, { headers });

    if (Array.isArray(response.data.runes)) {
      return response.data.runes;
    } else {
      console.warn('Unexpected response format');
      return [];
    }
  } catch (error) {
    console.error('Error fetching runes activities data:', error);
    if (error.response?.data) {
      console.error('API Error details:', error.response.data);
    }
    return [];
  }
}

async function insertRunesActivitiesToDB(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    console.error('Error: No valid activities data to insert');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting transaction for runes activities insertion');

    const insertQuery = `
      INSERT INTO runes_activities (
        rune_ticker,
        rune_name,
        symbol,
        txid,
        volume_24h,
        total_volume,
        total_transactions,
        unit_price_sats,
        transaction_count,
        image_uri,
        unit_price_change,
        holder_count,
        pending_count,
        market_cap,
        is_verified,
        divisibility,
        premine,
        rune_id_block,
        rune_id_tx,
        rune_number
      ) VALUES (
        $1, $2, $3, $4,
        CAST($5 AS NUMERIC(36,8)),
        CAST($6 AS NUMERIC(36,8)),
        $7,
        CAST($8 AS NUMERIC(36,8)),
        $9, $10,
        CAST($11 AS NUMERIC(36,8)),
        $12, $13,
        CAST($14 AS NUMERIC(36,8)),
        $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (rune_ticker)
      DO UPDATE SET
        volume_24h = CAST(EXCLUDED.volume_24h AS NUMERIC(36,8)),
        total_volume = CAST(EXCLUDED.total_volume AS NUMERIC(36,8)),
        total_transactions = EXCLUDED.total_transactions,
        unit_price_sats = CAST(EXCLUDED.unit_price_sats AS NUMERIC(36,8)),
        transaction_count = EXCLUDED.transaction_count,
        unit_price_change = CAST(EXCLUDED.unit_price_change AS NUMERIC(36,8)),
        holder_count = EXCLUDED.holder_count,
        pending_count = EXCLUDED.pending_count,
        market_cap = CAST(EXCLUDED.market_cap AS NUMERIC(36,8)),
        updated_at = NOW()
      RETURNING id;`;

    let successCount = 0;
    let skipCount = 0;

    for (const activity of activities) {
      const {
        rune: runeTicker,
        etching,
        vol,
        totalVol,
        totalTxns,
        unitPriceSats,
        txnCount,
        imageURI,
        unitPriceChange,
        holderCount,
        pendingCount,
        marketCap,
        isVerified
      } = activity;

      if (!runeTicker || !etching) {
        console.warn('Skipping activity due to missing required fields:', {
          runeTicker,
          etching
        });
        skipCount++;
        continue;
      }

      const values = [
        runeTicker,
        etching.runeName,
        etching.symbol,
        etching.txid,
        parseNumericValue(vol),
        parseNumericValue(totalVol),
        parseInt(totalTxns) || null,
        parseNumericValue(unitPriceSats),
        parseInt(txnCount) || null,
        imageURI,
        parseNumericValue(unitPriceChange),
        parseInt(holderCount) || null,
        parseInt(pendingCount) || null,
        parseNumericValue(marketCap),
        isVerified || false,
        parseInt(etching.divisibility) || null,
        etching.premine,
        parseInt(etching.runeId?.block) || null,
        parseInt(etching.runeId?.tx) || null,
        parseInt(etching.runeNumber) || null
      ];

      try {
        const result = await client.query(insertQuery, values);
        if (result.rowCount > 0) {
          successCount++;
          console.log(`Successfully processed rune activity:`, {
            runeTicker,
            txid: etching.txid
          });
        }
      } catch (error) {
        console.error(`Error inserting rune activity:`, {
          runeTicker,
          error: error.message
        });
        throw error;
      }
    }

    await client.query('COMMIT');
    console.log('Processing complete:');
    console.log(`- Inserted/Updated: ${successCount}`);
    console.log(`- Skipped: ${skipCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting runes activities data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateRunesActivities() {
  try {
    console.log(`[${new Date().toISOString()}] Starting runes activities update`);

    const activities = await fetchRunesActivitiesFromAPI();

    if (activities.length > 0) {
      await insertRunesActivitiesToDB(activities);
      console.log(`[${new Date().toISOString()}] Completed activities update`);
    } else {
      console.log(`[${new Date().toISOString()}] No activities found`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating runes activities:`, error);
    throw error;
  }
}

export {
  fetchRunesActivitiesFromAPI,
  insertRunesActivitiesToDB,
  updateRunesActivities
};