// src/app/api/bitcoin-blocks/route.js
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Create pool only if DATABASE_URL exists
let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
} catch (error) {
  console.error('Failed to initialize pool:', error);
}

export async function GET() {
  // Check if pool was initialized
  if (!pool) {
    return NextResponse.json(
      { error: 'Database configuration error' },
      { status: 500 }
    );
  }

  try {
    // Test the connection before query
    await pool.connect();

    const result = await pool.query(
      'SELECT * FROM blocks ORDER BY block_height DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No block data available' },
        { status: 404 }
      );
    }

    const latestBlock = result.rows[0];
    console.log('Latest block data:', latestBlock); // Debug log

    return NextResponse.json({
      feeEstimate: parseFloat(latestBlock.fees_estimate) || 0,
      feeSpan: {
        min: parseFloat(latestBlock.min_fee) || 0,
        max: parseFloat(latestBlock.max_fee) || 0
      },
      blockHeight: latestBlock.block_height,
      timestamp: latestBlock.timestamp
    });

  } catch (error) {
    console.error('Database query error:', error);
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    );
  }
}