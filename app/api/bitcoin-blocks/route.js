// app/api/bitcoin-blocks/route.js

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(req) {
  try {
    const result = await pool.query(
      'SELECT * FROM blocks ORDER BY block_height DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No block data available' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const latestBlock = result.rows[0];

    return new Response(JSON.stringify({
      feeEstimate: parseFloat(latestBlock.fees_estimate),
      feeSpan: {
        min: parseFloat(latestBlock.min_fee),
        max: parseFloat(latestBlock.max_fee)
      },
      blockHeight: latestBlock.block_height,
      timestamp: latestBlock.timestamp
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching fee estimates:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch fee estimates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}