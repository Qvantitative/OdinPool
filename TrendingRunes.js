// TrendingRunes.js

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

async function fetchRuneTickersFromAPI() {
  const url = "https://api.bestinslot.xyz/v3/runes/tickers";
  const headers = {
    "x-api-key": process.env.BESTIN_SLOT_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    console.log(`Fetching tickers from ${url}`);
    const response = await axios.get(url, {
      headers,
      params: {
        sort_by: 'total_volume',
        order: 'desc',
        count: 100  // Maximum allowed by API
      }
    });

    if (Array.isArray(response.data.data)) {
      return response.data.data;
    } else {
      console.warn('Unexpected response format');
      return [];
    }
  } catch (error) {
    console.error('Error fetching rune tickers data:', error);
    return [];
  }
}

async function insertRuneTickersToDB(tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    console.error('Error: No valid tickers data to insert');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting transaction');

    const insertQuery = `
      INSERT INTO trending_runes (
        rune_id,
        rune_number,
        rune_name,
        holder_count,
        total_volume,
        avg_price_sats,
        marketcap,
        event_count,
        circulating_supply,
        mint_progress
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (rune_id, created_at)
      DO UPDATE SET
        holder_count = EXCLUDED.holder_count,
        total_volume = EXCLUDED.total_volume,
        avg_price_sats = EXCLUDED.avg_price_sats,
        marketcap = EXCLUDED.marketcap,
        event_count = EXCLUDED.event_count,
        circulating_supply = EXCLUDED.circulating_supply,
        mint_progress = EXCLUDED.mint_progress;
    `;

    for (const ticker of tickers) {
      await client.query(insertQuery, [
        ticker.rune_id,
        ticker.rune_number,
        ticker.rune_name,
        ticker.holder_count,
        ticker.total_sale_info?.vol_total || 0,
        ticker.avg_unit_price_in_sats,
        ticker.marketcap,
        ticker.event_count,
        ticker.circulating_supply,
        ticker.mint_progress
      ]);
    }

    await client.query('COMMIT');
    console.log(`Successfully inserted/updated ${tickers.length} trending runes`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting trending runes data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function getTopTrendingRunes({ timeframe = '24h', limit = 10, metric = 'volume' } = {}) {
  const client = await pool.connect();

  try {
    let orderMetric;
    switch (metric.toLowerCase()) {
      case 'volume':
        orderMetric = 'total_volume';
        break;
      case 'marketcap':
        orderMetric = 'marketcap';
        break;
      case 'holders':
        orderMetric = 'holder_count';
        break;
      default:
        orderMetric = 'total_volume';
    }

    const query = `
      WITH latest_records AS (
        SELECT DISTINCT ON (rune_id) *
        FROM trending_runes
        WHERE created_at >= NOW() - INTERVAL '${timeframe}'
        ORDER BY rune_id, created_at DESC
      )
      SELECT *
      FROM latest_records
      ORDER BY ${orderMetric} DESC
      LIMIT $1;
    `;

    const result = await client.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching trending runes:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateTrendingRunes() {
  try {
    console.log(`[${new Date().toISOString()}] Starting trending runes update`);

    const tickers = await fetchRuneTickersFromAPI();

    if (tickers.length > 0) {
      await insertRuneTickersToDB(tickers);
      console.log(`[${new Date().toISOString()}] Completed update with ${tickers.length} tickers`);
    } else {
      console.log(`[${new Date().toISOString()}] No tickers found`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating trending runes:`, error);
    throw error;
  }
}

export {
  fetchRuneTickersFromAPI,
  insertRuneTickersToDB,
  getTopTrendingRunes,
  updateTrendingRunes
};