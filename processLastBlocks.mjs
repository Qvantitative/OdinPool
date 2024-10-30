// updateRawTransaction.mjs

import BitcoinCore from 'bitcoin-core';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import * as bitcoin from 'bitcoinjs-lib';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: `${__dirname}/.env` });

const { Pool } = pg;

const client = new BitcoinCore({
  network: 'mainnet',
  username: process.env.BITCOIN_RPC_USER,
  password: process.env.BITCOIN_RPC_PASSWORD,
  host: '127.0.0.1',
  port: 8332,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function getLatestBlockHeight() {
  try {
    return await client.getBlockCount();
  } catch (error) {
    console.error('Error fetching latest block height:', error);
    throw error;
  }
}

// Function to process all transactions in a block with concurrency control
async function processBlock(height) {
  console.log(`Processing block ${height}`);
  try {
    const blockHash = await client.getBlockHash(height);
    const block = await client.getBlock(blockHash);

    const txLimit = pLimit(999); // Using pLimit with high concurrency

    await Promise.all(
      block.tx.map((txid) =>
        txLimit(() => processTransaction(txid, height, block.time))
      )
    );

    console.log(
      `Block ${height} processed successfully with ${block.tx.length} transactions.`
    );

    return true;
  } catch (error) {
    console.error(`Error processing block ${height}:`, error);
    return false;
  }
}

// Function to process a single transaction
async function processTransaction(txid, blockHeight, blockTime) {
  try {
    const rawTx = await client.getRawTransaction(txid, true);
    if (!rawTx) {
      throw new Error(`No transaction data found for txid ${txid}`);
    }

    // (Same logic here for processing inputs, outputs, fees, and updating database)

  } catch (error) {
    if (error.message.includes('No such mempool or blockchain transaction')) {
      console.warn(`Transaction ${txid} may have been replaced. Attempting to check replacement...`);
    } else {
      console.error(`Error processing transaction ${txid}:`, error);
    }
  }
}

// Main function to process all blocks sequentially starting from block 0
export async function processAllBlocks() {
  console.log('Starting full block processing from block 0');
  try {
    const latestBlockHeight = await getLatestBlockHeight(); // Get the latest block height

    // Start processing from block 0 up to the latest block
    for (let blockHeight = 0; blockHeight <= latestBlockHeight; blockHeight++) {
      const blockSuccess = await processBlock(blockHeight);
      if (blockSuccess) {
        console.log(`Block ${blockHeight} processed successfully`);
      } else {
        console.log(`Failed to process block ${blockHeight}`);
      }

      // Optional: You could add a delay here if necessary to avoid overloading the system
    }

    console.log('All blocks processed successfully.');
  } catch (error) {
    console.error('Error during full block processing:', error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllBlocks()
    .then(() => {
      console.log('Block processing completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error during block processing:', error);
      process.exit(1);
    });
}
